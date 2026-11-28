import type GeoJSON from "geojson";
import { describe, expect, it, vi } from "vitest";
import { topology } from "topojson-server";
import { createProviderFromStore } from "../provider.js";
import type { RegionLoader } from "../store.js";
import {
  boundsIntersect,
  createRegionStore,
  levelForScale,
  sourceSummary,
} from "../store.js";

// Fiji ("FJ") stands in for any country.
// Two boxes, [longitude, latitude], clockwise (d3's winding).
const box = (west: number, south: number, east: number, north: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [west, south],
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  ],
});
const one = {
  type: "Feature" as const,
  properties: { i: "FJ-1", n: "One", s: "O" },
  geometry: box(0, 0, 1, 1),
};
const two = {
  type: "Feature" as const,
  properties: { i: "FJ-2", n: "Two", s: "T" },
  geometry: box(10, 0, 11, 1),
};
const empty = {
  type: "Feature" as const,
  properties: { i: "FJ-3", n: "Empty" },
  geometry: null,
};
const topo = (features: Array<GeoJSON.Feature<GeoJSON.Geometry | null>>) => {
  const collection: GeoJSON.FeatureCollection<GeoJSON.Geometry | null> = {
    type: "FeatureCollection",
    features,
  };
  return topology({ regions: collection });
};
const files: Record<string, unknown> = {
  // Level 0, with the bounds of the chunks of levels 1 and 2.
  FJ: {
    topology: topo([one, two, empty]),
    chunks: [
      [[0, 0, 11, 1]],
      [
        [0, 0, 1, 1],
        [10, 0, 11, 1],
      ],
    ],
  },
  "FJ-1-0": topo([one, two]),
  "FJ-2-0": topo([one]),
  // A CommonJS default export.
  "FJ-2-1": { default: topo([two]) },
};
const countries = { FJ: { name: "Example", regionCount: 2 } };

function makeStore(fail?: string) {
  const calls: string[] = [];
  const loaders: Record<string, RegionLoader> = {};
  for (const name of Object.keys(files)) {
    loaders[name] = vi.fn(() => {
      calls.push(name);
      return name === fail
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(files[name]);
    });
  }
  return { store: createRegionStore(loaders, countries), calls };
}

describe("createRegionStore", () => {
  it("loads level 0 from the country file, case-insensitively", async () => {
    const { store, calls } = makeStore();
    const collection = await store.load("fj", 0);
    expect(collection).toMatchObject({
      countryCode: "FJ",
      countryName: "Example",
      coverageStatus: "complete",
      sourceSummary,
    });
    expect(collection?.regions.map((region) => region.id)).toEqual([
      "FJ-1",
      "FJ-2",
    ]);
    expect(collection?.regions[0]).toMatchObject({
      name: "One",
      shortName: "O",
      geometry: { type: "Polygon" },
    });
    expect(await store.load("FJ", 0)).toBe(collection);
    expect(calls).toEqual(["FJ"]);
  });

  it("loads only the chunks in view, each once", async () => {
    const { store, calls } = makeStore();
    const west = await store.load("FJ", 2, [-1, -1, 2, 2]);
    expect(west?.regions.map((region) => region.id)).toEqual(["FJ-1"]);
    expect(calls).toEqual(["FJ", "FJ-2-0"]);
    expect(store.viewKey("FJ", 2, [-1, -1, 2, 2])).toBe("2:0");
    const all = await store.load("FJ", 2);
    expect(all?.regions.map((region) => region.id)).toEqual(["FJ-1", "FJ-2"]);
    expect(calls).toEqual(["FJ", "FJ-2-0", "FJ-2-1"]);
    expect(await store.load("FJ", 2, [-5, -5, 20, 5])).toBe(all);
  });

  it("keys a view only once the country file is known", async () => {
    const { store } = makeStore();
    expect(store.viewKey("FJ", 0)).toBe("0");
    expect(store.viewKey("FJ", 1)).toBeUndefined();
    await store.load("FJ", 1);
    expect(store.viewKey("FJ", 1, [50, 50, 60, 60])).toBe("1:");
  });

  it("prefetches the chunks for a view without decoding them", async () => {
    const { store, calls } = makeStore();
    store.prefetch("FJ", 2, [-1, -1, 2, 2]);
    store.prefetch("FJ", 0);
    store.prefetch("ZZ", 2);
    await vi.waitFor(() => expect(calls).toEqual(["FJ", "FJ-2-0"]));
    // Loading it later uses the downloaded file.
    await store.load("FJ", 2, [-1, -1, 2, 2]);
    expect(calls).toEqual(["FJ", "FJ-2-0"]);
  });

  it("resolves undefined for an unknown country", async () => {
    const { store } = makeStore();
    expect(store.has("ZZ")).toBe(false);
    expect(await store.load("ZZ")).toBeUndefined();
  });

  it("retries after a failed load", async () => {
    let offline = true;
    const calls: string[] = [];
    const store = createRegionStore(
      {
        FJ: () => Promise.resolve(files.FJ),
        "FJ-1-0": () => {
          calls.push("FJ-1-0");
          return offline
            ? Promise.reject(new Error("offline"))
            : Promise.resolve(files["FJ-1-0"]);
        },
      },
      countries,
    );
    await expect(store.load("FJ", 1)).rejects.toThrow("offline");
    offline = false;
    expect((await store.load("FJ", 1))?.regions).toHaveLength(2);
    expect(calls).toEqual(["FJ-1-0", "FJ-1-0"]);
  });

  it("rejects a missing file", async () => {
    const store = createRegionStore(
      { FJ: () => Promise.resolve(files.FJ) },
      countries,
    );
    await expect(store.load("FJ", 1)).rejects.toThrow("No region file");
  });
});

describe("bounds and levels", () => {
  it("picks the level of detail for the zoom", () => {
    expect(levelForScale(4)).toBe(0);
    expect(levelForScale(8)).toBe(1);
    expect(levelForScale(24)).toBe(2);
  });

  it("intersects bounds, across the antimeridian too", () => {
    expect(boundsIntersect([0, 0, 1, 1], [0.5, 0.5, 2, 2])).toBe(true);
    expect(boundsIntersect([0, 0, 1, 1], [2, 0, 3, 1])).toBe(false);
    expect(boundsIntersect([0, 0, 1, 1], [0, 2, 1, 3])).toBe(false);
    expect(boundsIntersect([170, 0, -170, 10], [-175, 5, -160, 6])).toBe(true);
    expect(boundsIntersect([170, 0, -170, 10], [0, 5, 10, 6])).toBe(false);
  });
});

describe("createProviderFromStore", () => {
  const view = (scale: number, bounds: [number, number, number, number]) => ({
    scale,
    bounds: [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ] as [[number, number], [number, number]],
  });

  it("loads level 1 without a view, as react-svg-worldmap 2.x asks", async () => {
    const { store, calls } = makeStore();
    const provider = createProviderFromStore(store);
    expect(provider.supports("FJ")).toBe(true);
    const result = await provider.loadRegions("FJ");
    expect(result).toMatchObject({ status: "ready", countryCode: "FJ" });
    expect(calls).toEqual(["FJ", "FJ-1-0"]);
  });

  it("loads the level and chunks for the view", async () => {
    const { store, calls } = makeStore();
    const provider = createProviderFromStore(store);
    expect(provider.viewKey("FJ", view(4, [-1, -1, 2, 2]))).toBe("0");
    // Before the country file is known, the key follows a grid.
    expect(provider.viewKey("FJ", view(30, [-1, -1, 2, 2]))).toBe(
      "2~-1,-1,0,0",
    );
    const result = await provider.loadRegions("FJ", view(30, [-1, -1, 2, 2]));
    expect(result.collection?.regions.map((region) => region.id)).toEqual([
      "FJ-1",
    ]);
    expect(provider.viewKey("FJ", view(30, [-1, -1, 2, 2]))).toBe("2:0");
    expect(calls).toEqual(["FJ", "FJ-2-0"]);
  });

  it("prefetches the next level when the next zoom step needs it", async () => {
    vi.useFakeTimers();
    const { store, calls } = makeStore();
    const provider = createProviderFromStore(store);
    // Zoom 16 is level 1; zoom 32 is level 2. Asking for the view's key is
    // enough.
    provider.viewKey("FJ", view(16, [-4, -4, 4, 4]));
    provider.viewKey("FJ", view(16, [-4, -4, 4, 4]));
    // From zoom 4 (level 0), the next step (8) is level 1.
    provider.viewKey("FJ", view(4, [-4, -4, 4, 4]));
    // From zoom 8, the next step (16) is level 1 again: nothing to fetch.
    provider.viewKey("FJ", view(8, [-4, -4, 4, 4]));
    await vi.runAllTimersAsync();
    expect(calls).toEqual(["FJ", "FJ-2-0", "FJ-1-0"]);
    // Across the antimeridian, the whole view.
    provider.viewKey("FJ", view(16, [170, -4, -170, 4]));
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("honours countries and exclude", async () => {
    const { store, calls } = makeStore();
    expect(
      createProviderFromStore(store, { countries: ["yy"] }).supports("FJ"),
    ).toBe(false);
    const excluded = createProviderFromStore(store, { exclude: ["fj"] });
    expect(excluded.supports("FJ")).toBe(false);
    expect(await excluded.loadRegions("FJ")).toMatchObject({
      status: "unavailable",
      countryCode: "FJ",
    });
    expect(calls).toEqual([]);
  });

  it("reports a failed load", async () => {
    const { store } = makeStore("FJ");
    const result = await createProviderFromStore(store).loadRegions("FJ");
    expect(result.status).toBe("failed");
    expect(result.warning).toContain("offline");
  });

  it("reports a view with no regions as unavailable", async () => {
    const { store } = makeStore();
    const result = await createProviderFromStore(store).loadRegions(
      "FJ",
      view(30, [50, 50, 60, 60]),
    );
    expect(result.status).toBe("unavailable");
  });
});
