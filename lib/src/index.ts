import type { RegionCollection } from "react-svg-worldmap";
import {
  allRegionCountries,
  governingRegionCountries,
  regionLoaders,
} from "./loaders.js";
import type {
  RegionsDetailProvider,
  RegionsDetailProviderOptions,
} from "./provider.js";
import { createProviderFromStore } from "./provider.js";
import type { Bounds, DetailLevel, RegionStore } from "./store.js";
import { createRegionStore } from "./store.js";

export type {
  RegionsDetailProvider,
  RegionsDetailProviderOptions,
  RegionsView,
} from "./provider.js";
export type { DetailLevel, RegionCountryInfo } from "./store.js";
export { sourceSummary, sourceUrl } from "./store.js";

/**
 * Which regions to use. `"governing"` (the default): only a level of
 * government between the country and its municipalities, such as US states
 * or Italian regions; countries without one (Israel, Ireland, the Baltic
 * states, ...) have none. `"all"`: Natural Earth's first-level
 * administrative divisions for every country, governing or not.
 */
export type RegionTier = "governing" | "all";

const stores: Record<RegionTier, RegionStore> = {
  governing: createRegionStore(
    regionLoaders,
    governingRegionCountries,
    (code) => (governingRegionCountries[code]?.own ? `${code}-G` : code),
  ),
  all: createRegionStore(regionLoaders, allRegionCountries),
};

/**
 * The countries with a governing middle tier, keyed by ISO 3166-1 alpha-2
 * code, with each country's name and region count. Reading this loads no
 * region data.
 */
export const regionCountries = governingRegionCountries;

/** Every country with administrative regions (tier `"all"`). */
export { allRegionCountries };

const sortedCodes = (countries: object): readonly string[] =>
  Object.keys(countries).sort((a, b) => a.localeCompare(b));

/** Codes of the countries with a governing middle tier, sorted. */
export const regionCountryCodes = sortedCodes(governingRegionCountries);

/** Codes of every country with administrative regions, sorted. */
export const allRegionCountryCodes = sortedCodes(allRegionCountries);

/** Whether the package has regions for a country, in a tier. */
export function hasRegions(
  countryCode: string,
  tier: RegionTier = "governing",
): boolean {
  return stores[tier].has(countryCode);
}

export interface LoadRegionsOptions {
  /** Level of detail: 0, 1 or 2 (the most detailed, default). */
  level?: DetailLevel;
  /** Only the part within `[west, south, east, north]`, in degrees. */
  bounds?: Bounds;
  /** Default `"governing"`. */
  tier?: RegionTier;
}

/**
 * Loads one country's regions. The data is split into files that bundlers
 * emit as chunks of their own, so each downloads only the first time it is
 * needed. Resolves to `undefined` for a country without regions in the
 * tier.
 */
export function loadRegionCollection(
  countryCode: string,
  { level = 2, bounds, tier = "governing" }: LoadRegionsOptions = {},
): Promise<RegionCollection | undefined> {
  return stores[tier].load(countryCode, level, bounds);
}

/**
 * Starts loading the regions of these countries ahead of time (default:
 * level 0, what the map shows first).
 */
export function preloadRegions(
  countryCodes: readonly string[],
  { level = 0, tier = "governing" }: LoadRegionsOptions = {},
): Promise<void> {
  return Promise.all(
    countryCodes.map((code) => stores[tier].load(code, level)),
  ).then(() => undefined);
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
  options: RegionsDetailProviderOptions = {},
): RegionsDetailProvider {
  return createProviderFromStore(stores[options.tier ?? "governing"], options);
}
