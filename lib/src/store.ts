import type GeoJSON from "geojson";
import type {
  ISOCode,
  RegionCollection,
  RegionFeature,
} from "react-svg-worldmap";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature as topoFeature } from "topojson-client";

/** Properties stored on each region in the generated topologies. */
export interface RegionProperties {
  /** Region id (ISO 3166-2 where Natural Earth has one). */
  i: string;
  /** Region name. */
  n: string;
  /** Short name, such as `MA` for Massachusetts. */
  s?: string;
}

export type RegionTopology = Topology<{
  regions: GeometryCollection<RegionProperties>;
}>;

/** What the generated index knows about a country without loading it. */
export interface RegionCountryInfo {
  /** Country name, as in react-svg-worldmap. */
  name: string;
  /** Number of regions. */
  regionCount: number;
}

export type RegionLoader = () => Promise<unknown>;

export const sourceSummary =
  "Natural Earth 1:10m Admin 1 – States, Provinces (v5.1.2), public domain";
export const sourceUrl =
  "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/";

// Native ESM and most bundlers expose module.exports as `default`; some
// CommonJS interop returns module.exports itself.
function unwrap(module: unknown): RegionTopology {
  const candidate = module as { default?: RegionTopology } & RegionTopology;
  return candidate.default ?? candidate;
}

export function decodeRegions(
  countryCode: ISOCode,
  topology: RegionTopology,
): RegionFeature[] {
  const collection = topoFeature(
    topology,
    topology.objects.regions,
  ) as GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon | null,
    RegionProperties
  >;
  return collection.features.flatMap((feature) =>
    feature.geometry == null
      ? []
      : [
          {
            id: feature.properties.i,
            countryCode,
            name: feature.properties.n,
            ...(feature.properties.s != null
              ? { shortName: feature.properties.s }
              : {}),
            geometry: feature.geometry,
          },
        ],
  );
}

/**
 * Loads and caches the region collections of the countries in `loaders`.
 * Each country loads at most once; a failed load can be retried.
 */
export function createRegionStore(
  loaders: Readonly<Record<string, RegionLoader>>,
  countries: Readonly<Record<string, RegionCountryInfo>>,
): {
  has: (countryCode: string) => boolean;
  load: (countryCode: string) => Promise<RegionCollection | undefined>;
} {
  const pending = new Map<string, Promise<RegionCollection>>();

  function has(countryCode: string): boolean {
    return Object.hasOwn(loaders, countryCode.toUpperCase());
  }

  function load(countryCode: string): Promise<RegionCollection | undefined> {
    const code = countryCode.toUpperCase();
    if (!has(code)) return Promise.resolve(undefined);
    let promise = pending.get(code);
    if (!promise) {
      promise = loaders[code]!().then((module) => ({
        countryCode: code as ISOCode,
        countryName: countries[code]?.name ?? code,
        coverageStatus: "complete",
        regions: decodeRegions(code as ISOCode, unwrap(module)),
        sourceSummary,
        sourceUrl,
      }));
      pending.set(code, promise);
      promise.catch(() => {
        pending.delete(code);
      });
    }
    return promise;
  }

  return { has, load };
}
