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

/** `[west, south, east, north]` in degrees; west > east across 180°. */
export type Bounds = readonly [number, number, number, number];

/**
 * A country's level-0 file: its coarse regions, and the bounds of each
 * chunk of levels 1 and 2.
 */
export interface CountryManifest {
  topology: RegionTopology;
  chunks: [Bounds[], Bounds[]];
}

/** What the generated index knows about a country without loading it. */
export interface RegionCountryInfo {
  /** Country name, as in react-svg-worldmap. */
  name: string;
  /** Number of regions. */
  regionCount: number;
  /** Where the regions come from, when not Natural Earth. */
  source?: string;
  sourceUrl?: string;
}

export type RegionLoader = () => Promise<unknown>;

/**
 * Level of detail: 0 is one small file per country (zoom below 8), 1 and 2
 * are split into chunks of nearby regions (zoom 8 to 24, and above).
 */
export type DetailLevel = 0 | 1 | 2;

export function levelForScale(scale: number): DetailLevel {
  if (scale < 8) return 0;
  return scale < 24 ? 1 : 2;
}

export const sourceSummary =
  "Natural Earth 1:10m Admin 1 – States, Provinces (v5.1.2), public domain";
export const sourceUrl =
  "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/";

// Native ESM and most bundlers expose module.exports as `default`; some
// CommonJS interop returns module.exports itself.
function unwrap<T>(module: unknown): T {
  const candidate = module as { default?: T } & T;
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

// Longitude spans as segments in [-180, 180], split at the antimeridian.
function spans(west: number, east: number): Array<[number, number]> {
  return west <= east
    ? [[west, east]]
    : [
        [west, 180],
        [-180, east],
      ];
}

/** Whether two bounds overlap, across the antimeridian too. */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  if (a[1] > b[3] || b[1] > a[3]) return false;
  return spans(a[0], a[2]).some(([w1, e1]) =>
    spans(b[0], b[2]).some(([w2, e2]) => w1 <= e2 && w2 <= e1),
  );
}

/**
 * Loads and caches region data: each file once, each decoded once, and the
 * same collection object for the same country, level and chunks (so the map
 * can reuse its projected paths). A failed load can be retried.
 */
export interface RegionStore {
  has: (countryCode: string) => boolean;
  load: (
    countryCode: string,
    level?: DetailLevel,
    bounds?: Bounds,
  ) => Promise<RegionCollection | undefined>;
  viewKey: (
    countryCode: string,
    level: DetailLevel,
    bounds?: Bounds,
  ) => string | undefined;
  /**
   * Downloads (without decoding) the files `load` would need, so a later
   * load does not wait for the network.
   */
  prefetch: (countryCode: string, level: DetailLevel, bounds?: Bounds) => void;
}

export function createRegionStore(
  loaders: Readonly<Record<string, RegionLoader>>,
  countries: Readonly<Record<string, RegionCountryInfo>>,
  /** The file name of a country's regions (default: its code). */
  baseOf: (countryCode: string) => string = (countryCode) => countryCode,
): RegionStore {
  const files = new Map<string, Promise<unknown>>();
  const decoded = new Map<string, RegionFeature[]>();
  const manifests = new Map<string, CountryManifest>();
  const collections = new Map<string, RegionCollection>();

  function has(countryCode: string): boolean {
    return Object.hasOwn(countries, countryCode.toUpperCase());
  }

  function loadFile(name: string): Promise<unknown> {
    let promise = files.get(name);
    if (!promise) {
      const loader = loaders[name];
      promise = loader
        ? loader()
        : Promise.reject(new Error(`No region file ${name}`));
      files.set(name, promise);
      promise.catch(() => {
        files.delete(name);
      });
    }
    return promise;
  }

  async function manifest(code: string): Promise<CountryManifest> {
    const known = manifests.get(code);
    if (known) return known;
    const loaded = unwrap<CountryManifest>(await loadFile(baseOf(code)));
    manifests.set(code, loaded);
    return loaded;
  }

  async function regionsOf(
    code: string,
    name: string,
    topology: () => Promise<RegionTopology>,
  ): Promise<RegionFeature[]> {
    let regions = decoded.get(name);
    if (!regions) {
      regions = decodeRegions(code as ISOCode, await topology());
      decoded.set(name, regions);
    }
    return regions;
  }

  /** The chunks of a level that overlap `bounds` (all without bounds). */
  function chunksInView(
    known: CountryManifest,
    level: 1 | 2,
    bounds?: Bounds,
  ): number[] {
    return (known.chunks[level - 1] ?? []).flatMap((chunk, index) =>
      bounds == null || boundsIntersect(chunk, bounds) ? [index] : [],
    );
  }

  /**
   * A key for what `load` would return, or undefined until the country's
   * level-0 file has loaded.
   */
  function viewKey(
    countryCode: string,
    level: DetailLevel,
    bounds?: Bounds,
  ): string | undefined {
    const code = countryCode.toUpperCase();
    if (level === 0) return "0";
    const known = manifests.get(code);
    return known
      ? `${level}:${chunksInView(known, level, bounds).join(",")}`
      : undefined;
  }

  async function load(
    countryCode: string,
    level: DetailLevel = 2,
    bounds?: Bounds,
  ): Promise<RegionCollection | undefined> {
    const code = countryCode.toUpperCase();
    if (!has(code)) return undefined;
    const known = await manifest(code);
    const chunks = level === 0 ? [] : chunksInView(known, level, bounds);
    const key = `${code}|${level}|${chunks.join(",")}`;
    const cached = collections.get(key);
    if (cached) return cached;
    const parts =
      level === 0
        ? [
            await regionsOf(code, baseOf(code), () =>
              Promise.resolve(known.topology),
            ),
          ]
        : await Promise.all(
            chunks.map((index) => {
              const name = `${baseOf(code)}-${level}-${index}`;
              return regionsOf(code, name, async () =>
                unwrap<RegionTopology>(await loadFile(name)),
              );
            }),
          );
    const collection: RegionCollection = {
      countryCode: code as ISOCode,
      countryName: countries[code]?.name ?? code,
      coverageStatus: "complete",
      regions: parts.flat(),
      sourceSummary: countries[code]?.source ?? sourceSummary,
      sourceUrl: countries[code]?.sourceUrl ?? sourceUrl,
    };
    collections.set(key, collection);
    return collection;
  }

  function prefetch(
    countryCode: string,
    level: DetailLevel,
    bounds?: Bounds,
  ): void {
    const code = countryCode.toUpperCase();
    if (!has(code) || level === 0) return;
    manifest(code).then(
      (known) => {
        for (const index of chunksInView(known, level, bounds))
          loadFile(`${baseOf(code)}-${level}-${index}`).catch(() => undefined);
      },
      () => undefined,
    );
  }

  return { has, load, viewKey, prefetch };
}
