import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { regions as mapCountries } from "react-svg-worldmap";
import {
  allRegionCountries,
  allRegionCountryCodes,
  hasRegions,
  loadRegionCollection,
  preloadRegions,
  regionCountries,
  regionCountryCodes,
} from "../index.js";
import type { RegionTier } from "../index.js";
import { regionLoaders } from "../loaders.js";

const governingTiers = JSON.parse(
  readFileSync(path.join(__dirname, "../../data/governing-tiers.json"), "utf8"),
) as { countries: Record<string, { tier: string }> };

describe("generated region data", () => {
  it("covers only countries the map draws, each with a data file", () => {
    const mapCodes = new Set(mapCountries.map(({ code }) => code));
    expect(allRegionCountryCodes.length).toBeGreaterThan(150);
    expect(regionCountryCodes.length).toBeLessThan(
      allRegionCountryCodes.length,
    );
    for (const code of allRegionCountryCodes) {
      expect(mapCodes.has(code)).toBe(true);
      expect(regionLoaders[code]).toBeTypeOf("function");
      expect(existsSync(path.join(__dirname, `../regions/${code}.cjs`))).toBe(
        true,
      );
    }
    expect(hasRegions("us")).toBe(true);
    expect(hasRegions("AQ")).toBe(false);
    // Israel has districts, but no government between the country and its
    // municipalities.
    expect(hasRegions("IL")).toBe(false);
    expect(hasRegions("IL", "all")).toBe(true);
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

  it.each([
    ["governing", regionCountryCodes, regionCountries],
    ["all", allRegionCountryCodes, allRegionCountries],
  ] as const)(
    "has unique ids and the region count of the index (%s)",
    async (tier, codes, countries) => {
      await preloadRegions(codes, { tier: tier as RegionTier });
      for (const code of codes) {
        const collection = await loadRegionCollection(code, {
          tier: tier as RegionTier,
        });
        const ids = collection!.regions.map((region) => region.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(`${code} ${ids.length}`).toBe(
          `${code} ${
            (countries as Record<string, { regionCount: number }>)[code]!
              .regionCount
          }`,
        );
        for (const region of collection!.regions)
          expect(["Polygon", "MultiPolygon"]).toContain(region.geometry.type);
        const shortNames = collection!.regions.map(
          (region) => (region as { shortName?: string }).shortName,
        );
        expect(
          shortNames.every((name) => name != null && name.length > 0),
        ).toBe(true);
        expect(new Set(shortNames).size).toBe(shortNames.length);
        // Never just a number.
        for (const name of shortNames) expect(name).toMatch(/^[A-Za-z]+$/);
      }
    },
  );

  it("uses ISO 3166-2 ids for the United States", async () => {
    const us = await loadRegionCollection("US");
    const ids = us!.regions.map((region) => region.id);
    expect(ids).toContain("US-CA");
    expect(ids).toContain("US-DC");
    expect(ids.length).toBe(51);
    const massachusetts = us!.regions.find((region) => region.id === "US-MA");
    expect(massachusetts).toMatchObject({
      name: "Massachusetts",
      shortName: "MA",
    });
  });

  it("follows lib/data/governing-tiers.json", async () => {
    const tiers = governingTiers.countries;
    for (const code of allRegionCountryCodes)
      expect(hasRegions(code)).toBe(tiers[code]!.tier !== "none");
    const names = async (code: string) =>
      (await loadRegionCollection(code))!.regions.map((region) => region.name);
    expect(await names("IT")).toHaveLength(20);
    expect(await names("GB")).toEqual(
      expect.arrayContaining(["Scotland", "Wales", "Northern Ireland"]),
    );
    expect(await names("GB")).toHaveLength(3);
    expect(await names("KE")).toHaveLength(47);
    expect(await names("PT")).toEqual(["Azores", "Madeira"]);
    expect((await loadRegionCollection("KE"))!.sourceSummary).toContain(
      "geoBoundaries",
    );
    expect(
      (await loadRegionCollection("IT", { tier: "all" }))!.regions,
    ).toHaveLength(110);
  });
});
