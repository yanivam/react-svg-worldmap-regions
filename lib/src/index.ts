import type { DetailProvider, RegionCollection } from "react-svg-worldmap";
import { regionCountries, regionLoaders } from "./loaders.js";
import type { RegionsDetailProviderOptions } from "./provider.js";
import { createProviderFromStore } from "./provider.js";
import { createRegionStore } from "./store.js";

export type { RegionsDetailProviderOptions } from "./provider.js";
export type { RegionCountryInfo } from "./store.js";
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
 * Loads one country's regions. Each country is a separate file that bundlers
 * emit as its own chunk, so it downloads only the first time it is asked
 * for. Resolves to `undefined` for a country without regions.
 */
export function loadRegionCollection(
  countryCode: string,
): Promise<RegionCollection | undefined> {
  return store.load(countryCode);
}

/** Starts loading the regions of these countries ahead of time. */
export function preloadRegions(countryCodes: readonly string[]): Promise<void> {
  return Promise.all(countryCodes.map((code) => store.load(code))).then(
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
 * Create it once (outside the component or with `useMemo`): the map loads
 * each country at most once per provider.
 */
export function createRegionsDetailProvider(
  options?: RegionsDetailProviderOptions,
): DetailProvider {
  return createProviderFromStore(store, options);
}
