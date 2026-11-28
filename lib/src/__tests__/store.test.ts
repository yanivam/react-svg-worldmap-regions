import type GeoJSON from "geojson";
import { describe, expect, it, vi } from "vitest";
import { topology } from "topojson-server";
import { createProviderFromStore } from "../provider.js";
import type { RegionLoader } from "../store.js";
import { createRegionStore, sourceSummary } from "../store.js";

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
const fixtureRegions: GeoJSON.FeatureCollection<GeoJSON.Geometry | null> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { i: "FJ-1", n: "One", s: "O" },
      geometry: box(0, 0, 1, 1),
    },
    {
      type: "Feature",
      properties: { i: "FJ-2", n: "Two" },
      geometry: box(1, 0, 2, 1),
    },
    { type: "Feature", properties: { i: "FJ-3", n: "Empty" }, geometry: null },
  ],
};
const fixture = topology({ regions: fixtureRegions });
const countries = { FJ: { name: "Example", regionCount: 2 } };

function makeStore(loader: RegionLoader = () => Promise.resolve(fixture)) {
  const load = vi.fn(loader);
  return { store: createRegionStore({ FJ: load }, countries), load };
}

describe("createRegionStore", () => {
  it("decodes a country once, case-insensitively", async () => {
    const { store, load } = makeStore();
    const collection = await store.load("fj");
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
      countryCode: "FJ",
      name: "One",
      shortName: "O",
      geometry: { type: "Polygon" },
    });
    await store.load("FJ");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("unwraps a CommonJS default export", async () => {
    const { store } = makeStore(() => Promise.resolve({ default: fixture }));
    expect((await store.load("FJ"))?.regions).toHaveLength(2);
  });

  it("resolves undefined for an unknown country", async () => {
    const { store } = makeStore();
    expect(store.has("ZZ")).toBe(false);
    expect(await store.load("ZZ")).toBeUndefined();
  });

  it("retries after a failed load", async () => {
    const { store, load } = makeStore();
    load.mockRejectedValueOnce(new Error("offline"));
    await expect(store.load("FJ")).rejects.toThrow("offline");
    expect((await store.load("FJ"))?.regions).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("createProviderFromStore", () => {
  it("returns a ready result", async () => {
    const { store } = makeStore();
    const provider = createProviderFromStore(store);
    expect(provider.supports("FJ")).toBe(true);
    const result = await provider.loadRegions("FJ");
    expect(result).toMatchObject({
      status: "ready",
      layer: "regions",
      countryCode: "FJ",
    });
  });

  it("honours countries and exclude", async () => {
    const { store, load } = makeStore();
    expect(
      createProviderFromStore(store, { countries: ["yy"] }).supports("FJ"),
    ).toBe(false);
    const excluded = createProviderFromStore(store, { exclude: ["fj"] });
    expect(excluded.supports("FJ")).toBe(false);
    expect(await excluded.loadRegions("FJ")).toMatchObject({
      status: "unavailable",
      countryCode: "FJ",
    });
    expect(load).not.toHaveBeenCalled();
    expect(
      createProviderFromStore(store, { countries: ["fj"] }).supports("FJ"),
    ).toBe(true);
  });

  it("reports a failed load", async () => {
    const { store } = makeStore(() => Promise.reject(new Error("offline")));
    const result = await createProviderFromStore(store).loadRegions("FJ");
    expect(result.status).toBe("failed");
    expect(result.warning).toContain("offline");
  });

  it("reports a non-Error failure with the default warning", async () => {
    // eslint-disable-next-line prefer-promise-reject-errors -- tests a non-Error rejection.
    const { store } = makeStore(() => Promise.reject("nope"));
    const result = await createProviderFromStore(store).loadRegions("FJ");
    expect(result).toMatchObject({ status: "failed" });
  });

  it("reports a country whose regions are all empty as unavailable", async () => {
    const noRegions: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [],
    };
    const empty = topology({ regions: noRegions });
    const { store } = makeStore(() => Promise.resolve(empty));
    const result = await createProviderFromStore(store).loadRegions("FJ");
    expect(result.status).toBe("unavailable");
  });
});
