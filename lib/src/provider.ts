import type { DetailProvider, ISOCode } from "react-svg-worldmap";
import {
  createFailedDetailResult,
  createReadyDetailResult,
  createUnavailableDetailResult,
} from "react-svg-worldmap";
import type { createRegionStore } from "./store.js";

export interface RegionsDetailProviderOptions {
  /**
   * Only these countries (ISO 3166-1 alpha-2 codes) get regions. Default:
   * every country in the package.
   */
  countries?: readonly string[];
  /** Countries that never get regions. Applied after `countries`. */
  exclude?: readonly string[];
}

type Store = ReturnType<typeof createRegionStore>;

export function createProviderFromStore(
  store: Store,
  options: RegionsDetailProviderOptions = {},
): DetailProvider {
  const only =
    options.countries != null
      ? new Set(options.countries.map((code) => code.toUpperCase()))
      : undefined;
  const excluded = new Set(
    (options.exclude ?? []).map((code) => code.toUpperCase()),
  );

  function supports(countryCode: ISOCode): boolean {
    const code = countryCode.toUpperCase();
    if (only && !only.has(code)) return false;
    if (excluded.has(code)) return false;
    return store.has(code);
  }

  return {
    supports,
    async loadRegions(countryCode) {
      if (!supports(countryCode)) {
        return createUnavailableDetailResult(
          countryCode,
          `No regions for ${countryCode.toUpperCase()}.`,
        );
      }
      try {
        const collection = await store.load(countryCode);
        if (!collection || collection.regions.length === 0)
          return createUnavailableDetailResult(countryCode);
        return createReadyDetailResult(collection);
      } catch (error) {
        return createFailedDetailResult(
          countryCode,
          error instanceof Error
            ? `Regions for ${countryCode.toUpperCase()} could not be loaded: ${error.message}`
            : undefined,
        );
      }
    },
  };
}
