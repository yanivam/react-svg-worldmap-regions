import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { regions as mapCountries } from "react-svg-worldmap";
import {
  hasRegions,
  loadRegionCollection,
  preloadRegions,
  regionCountries,
  regionCountryCodes,
} from "../index.js";
import { regionLoaders } from "../loaders.js";

describe("generated region data", () => {
  it("covers only countries the map draws, each with a data file", () => {
    const mapCodes = new Set(mapCountries.map(({ code }) => code));
    expect(regionCountryCodes.length).toBeGreaterThan(150);
    for (const code of regionCountryCodes) {
      expect(mapCodes.has(code)).toBe(true);
      expect(regionLoaders[code]).toBeTypeOf("function");
      expect(existsSync(path.join(__dirname, `../regions/${code}.cjs`))).toBe(
        true,
      );
    }
    expect(hasRegions("us")).toBe(true);
    expect(hasRegions("AQ")).toBe(false);
  });

  it("puts Crimea and Sevastopol in Ukraine and not in Russia", async () => {
    const ukraine = await loadRegionCollection("UA");
    const russia = await loadRegionCollection("RU");
    const ukraineIds = ukraine!.regions.map((region) => region.id);
    expect(ukraineIds).toContain("UA-43");
    expect(ukraineIds).toContain("UA-40");
    const russiaIds = russia!.regions.map((region) => region.id);
    expect(russiaIds).not.toContain("UA-43");
    expect(russiaIds).not.toContain("UA-40");
    expect(russia!.regions.some((region) => /Crimea/i.test(region.name))).toBe(
      false,
    );
  });

  it("has unique ids and the region count of the index", async () => {
    await preloadRegions(regionCountryCodes);
    for (const code of regionCountryCodes) {
      const collection = await loadRegionCollection(code);
      const ids = collection!.regions.map((region) => region.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(regionCountries[code]!.regionCount);
      for (const region of collection!.regions)
        expect(["Polygon", "MultiPolygon"]).toContain(region.geometry.type);
    }
  });

  it("uses ISO 3166-2 ids for the United States", async () => {
    const us = await loadRegionCollection("US");
    const ids = us!.regions.map((region) => region.id);
    expect(ids).toContain("US-CA");
    expect(ids).toContain("US-DC");
    expect(ids.length).toBe(51);
  });
});
