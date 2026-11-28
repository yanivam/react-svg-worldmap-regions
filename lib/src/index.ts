import type { RegionCollection } from "react-svg-worldmap";
import { regionCountries, regionLoaders } from "./loaders.js";
import type {
  RegionsDetailProvider,
  RegionsDetailProviderOptions,
} from "./provider.js";
import { createProviderFromStore } from "./provider.js";
import { createRegionStore } from "./store.js";
import type { DetailLevel } from "./store.js";

export type {
  RegionsDetailProvider,
  RegionsDetailProviderOptions,
  RegionsView,
} from "./provider.js";
export type { DetailLevel, RegionCountryInfo } from "./store.js";
export { sourceSummary, sourceUrl } from "./store.js";

const store = createRegionStore(regionLoaders, regionCountries);

/**
 * ISO 3166-1 alpha-2 codes of the countries that have regions, with each
 * country's name and region count. Reading this loads no region data.
 */
export { regionCountries };

/** Codes of the countries that have regions, sorted. */
export const regionCountryCodes: readonly string[] = Object.keys(
  regionCountries,
).sort((a, b) => a.localeCompare(b));

/** Whether the package has regions for a country. */
export function hasRegions(countryCode: string): boolean {
  return store.has(countryCode);
}

/**
 * Loads one country's regions, at a level of detail (default 2, the most
 * detailed) and optionally only the part within `[west, south, east, north]`
 * bounds. The data is split into files that bundlers emit as chunks of their
 * own, so each downloads only the first time it is needed. Resolves to
 * `undefined` for a country without regions.
 */
export function loadRegionCollection(
  countryCode: string,
  level: DetailLevel = 2,
  bounds?: readonly [number, number, number, number],
): Promise<RegionCollection | undefined> {
  return store.load(countryCode, level, bounds);
}

/**
 * Starts loading the regions of these countries ahead of time, at a level of
 * detail (default 0, what the map shows first).
 */
export function preloadRegions(
  countryCodes: readonly string[],
  level: DetailLevel = 0,
): Promise<void> {
  return Promise.all(countryCodes.map((code) => store.load(code, level))).then(
    () => undefined,
  );
}

/**
 * A `detailProvider` for `<WorldMap detailLevel="regions" />`: draws the
 * states / provinces of the countries in view once the map is zoomed in.
 *
 * ```tsx
 * const provider = createRegionsDetailProvider();
 * <WorldMap data={data} zoom detailLevel="regions" detailProvider={provider} />
 * ```
 *
 * Create it once (outside the component or with `useMemo`). With
 * react-svg-worldmap 3, it loads a coarse file per country below zoom 8, and
 * above that only the chunks of the country in view, in more detail as you
 * zoom in. With 2.x, it loads each country once.
 */
export function createRegionsDetailProvider(
  options?: RegionsDetailProviderOptions,
): RegionsDetailProvider {
  return createProviderFromStore(store, options);
}
