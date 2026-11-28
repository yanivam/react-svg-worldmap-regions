import type { DetailProvider, ISOCode } from "react-svg-worldmap";
import {
  createFailedDetailResult,
  createReadyDetailResult,
  createUnavailableDetailResult,
} from "react-svg-worldmap";
import type { Bounds, RegionStore } from "./store.js";
import { levelForScale } from "./store.js";

export interface RegionsDetailProviderOptions {
  /**
   * Only these countries (ISO 3166-1 alpha-2 codes) get regions. Default:
   * every country in the package.
   */
  countries?: readonly string[];
  /** Countries that never get regions. Applied after `countries`. */
  exclude?: readonly string[];
}

/** The view react-svg-worldmap 3 passes to `loadRegions` and `viewKey`. */
export interface RegionsView {
  scale: number;
  bounds: [[number, number], [number, number]];
}

/** A `DetailProvider` that loads only the regions in view. */
export interface RegionsDetailProvider extends DetailProvider {
  loadRegions: (
    countryCode: ISOCode,
    view?: RegionsView,
  ) => ReturnType<DetailProvider["loadRegions"]>;
  viewKey: (countryCode: ISOCode, view: RegionsView) => string;
}

type Store = RegionStore;

// Before a country's level-0 file has loaded, the key follows a grid of the
// view, so the map asks again (and gets only the chunks in view) once it has.
const gridSize = { 1: 10, 2: 2.5 };

function toBounds({
  bounds: [[west, south], [east, north]],
}: RegionsView): Bounds {
  return [west, south, east, north];
}

// When the next zoom step (2x) reaches a finer level, download its chunks
// for the middle of the view while the browser is idle.
function scheduleIdle(task: () => void): void {
  if (typeof globalThis.requestIdleCallback === "function")
    globalThis.requestIdleCallback(task, { timeout: 2000 });
  else setTimeout(task, 200);
}

export function createProviderFromStore(
  store: Store,
  options: RegionsDetailProviderOptions = {},
): RegionsDetailProvider {
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

  // Each country, level and view is prefetched once.
  const prefetched = new Set<string>();
  function prefetchNextLevel(countryCode: ISOCode, view: RegionsView): void {
    const level = levelForScale(view.scale);
    const next = levelForScale(view.scale * 2);
    if (next === level || !supports(countryCode)) return;
    const [west, south, east, north] = toBounds(view);
    const key = [countryCode, next, west, south, east, north]
      .map((value) => (typeof value === "number" ? value.toFixed(1) : value))
      .join("|");
    if (prefetched.has(key)) return;
    prefetched.add(key);
    if (west > east) {
      // Across the antimeridian: the whole view.
      scheduleIdle(() =>
        store.prefetch(countryCode, next, [west, south, east, north]),
      );
      return;
    }
    // The next step shows the middle half of the view.
    const quarterX = (east - west) / 4;
    const quarterY = (north - south) / 4;
    const middle: Bounds = [
      west + quarterX,
      south + quarterY,
      east - quarterX,
      north - quarterY,
    ];
    scheduleIdle(() => store.prefetch(countryCode, next, middle));
  }

  return {
    supports,
    viewKey(countryCode, view) {
      prefetchNextLevel(countryCode, view);
      const level = levelForScale(view.scale);
      const bounds = toBounds(view);
      const key = store.viewKey(countryCode, level, bounds);
      if (key != null) return key;
      const size = gridSize[level as 1 | 2];
      const cell = (value: number) => Math.floor(value / size);
      return `${level}~${cell(bounds[0])},${cell(bounds[1])},${cell(bounds[2])},${cell(bounds[3])}`;
    },
    async loadRegions(countryCode, view) {
      if (!supports(countryCode)) {
        return createUnavailableDetailResult(
          countryCode,
          `No regions for ${countryCode.toUpperCase()}.`,
        );
      }
      try {
        // Without a view (react-svg-worldmap 2.x), the whole country at
        // level 1.
        const collection = await (view
          ? store.load(countryCode, levelForScale(view.scale), toBounds(view))
          : store.load(countryCode, 1));
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
