/**
 * Builds the region (admin-1) data: one file per country in src/regions/
 * (XX.cjs, loaded lazily) and the index src/loaders.ts.
 *
 * Input: Natural Earth 1:10m Admin 1 - States, Provinces, v5.1.2 (public
 * domain), downloaded once into ../.cache/ and checked against a pinned
 * SHA-256. The country list and names come from react-svg-worldmap's
 * `regions` export, so every region belongs to a country the map draws.
 *
 * Assignment policy (react-svg-worldmap docs/map-data-policy.md):
 * - Crimea (UA-43) and Sevastopol (UA-40) are regions of Ukraine, as in the
 *   map's country tiers. The build fails if they end up anywhere else.
 * - A Natural Earth unit whose country is not on the map is left out; the
 *   build lists them (see `omittedCountries`) and fails on any unknown one.
 *
 * Run from lib/:
 *   node scripts/build-regions.mjs          # write the data
 *   node scripts/build-regions.mjs --check  # fail if the data is out of date
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { geoArea, geoBounds, geoCentroid, geoContains } from "d3-geo";
import { regions as mapCountries } from "react-svg-worldmap";
import { feature, mergeArcs, quantize } from "topojson-client";
import { topology } from "topojson-server";
import {
  presimplify,
  simplify,
  sphericalTriangleArea,
} from "topojson-simplify";

const libRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const regionsDir = path.join(libRoot, "src/regions");
const loadersPath = path.join(libRoot, "src/loaders.ts");
const cacheDir = path.join(libRoot, "../.cache");

const sourceVersion = "v5.1.2";
const sourceFile = "ne_10m_admin_1_states_provinces.geojson";
const sourceUrl = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${sourceVersion}/geojson/${sourceFile}`;
const sourceSha256 =
  "22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5";
const sourcePath = path.join(cacheDir, `${sourceVersion}-${sourceFile}`);

// Levels of detail. Level 0 is one small file per country, for zoom below 8;
// levels 1 and 2 are split into chunks of nearby regions (at most
// `chunkSize` bytes), so a zoomed-in map loads only the part in view.
// `minWeight` is the smallest triangle Visvalingam simplification keeps, in
// steradians; `quantization` is per file.
const levels = [
  { minWeight: 1e-6, quantization: 1e4 },
  { minWeight: 1e-7, quantization: 1e5 },
  { minWeight: 2.5e-9, quantization: 2e5 },
];
const chunkSize = 48 * 1024;

const check = process.argv.includes("--check");

// Cspell:disable -- Natural Earth names and codes.

// Natural Earth `adm0_a3` -> map country code, where `iso_a2` is not usable.
const countryOverrides = {
  KOS: "XK",
  SOL: "SOM",
  CYN: "CYP",
};

// Region ids that move to another country (see the policy above).
const crimea = { "UA-43": "UA", "UA-40": "UA" };

// Natural Earth units that the map draws as part of another country (as
// react-svg-worldmap's detailed tier does) become one region of it each.
const mergedUnits = {
  HKG: { country: "CN", id: "CN-HK", name: "Hong Kong", short: "HK" },
  MAC: { country: "CN", id: "CN-MO", name: "Macau", short: "MO" },
  ESB: { country: "CY", id: "CY-X-DHEKELIA", name: "Dhekelia", short: "DHK" },
  WSB: { country: "CY", id: "CY-X-AKROTIRI", name: "Akrotiri", short: "AKR" },
  KAB: { country: "KZ", id: "KZ-X-BAIKONUR", name: "Baikonur", short: "BKN" },
  USG: {
    country: "CU",
    id: "CU-X-GUANTANAMO",
    name: "Guantánamo Bay",
    short: "GTMO",
  },
};

// Cspell:enable

async function readSource() {
  if (!existsSync(sourcePath)) {
    console.log(`Downloading ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok)
      throw new Error(`Download failed: ${response.status} ${sourceUrl}`);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(sourcePath, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = readFileSync(sourcePath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== sourceSha256) {
    throw new Error(
      `${sourcePath} has SHA-256 ${sha}, expected ${sourceSha256}. Delete it and run again.`,
    );
  }
  return JSON.parse(bytes.toString("utf8"));
}

// Each polygon in d3's winding: the exterior ring clockwise, so the polygon
// covers less than a hemisphere.
function rewind(geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return {
    type: "MultiPolygon",
    coordinates: polygons.map((rings) =>
      geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI
        ? rings.map((ring) => ring.slice().reverse())
        : rings,
    ),
  };
}

function countryOf(properties, mapCodes) {
  const merged = mergedUnits[properties.adm0_a3];
  if (merged != null) return merged.country;
  const id = properties.iso_3166_2;
  if (crimea[id] != null) return crimea[id];
  const override = countryOverrides[properties.adm0_a3];
  if (override != null) return override;
  const iso = properties.iso_a2;
  if (mapCodes.has(iso)) return iso;
  const prefix = typeof id === "string" ? id.split("-")[0] : "";
  if (mapCodes.has(prefix)) return prefix;
  return null;
}

function groupByCountry(source) {
  const names = new Map(mapCountries.map(({ code, name }) => [code, name]));
  const byCountry = new Map();
  const omitted = new Map();
  for (const unit of source.features) {
    if (unit.geometry == null) continue;
    const code = countryOf(unit.properties, names);
    if (code == null || !names.has(code)) {
      const key = `${unit.properties.admin} (${unit.properties.iso_a2})`;
      omitted.set(key, (omitted.get(key) ?? 0) + 1);
      continue;
    }
    if (!byCountry.has(code)) byCountry.set(code, []);
    byCountry.get(code).push(unit);
  }
  return { byCountry, omitted, names };
}

// Stable ids: ISO 3166-2 where Natural Earth has a unique one, otherwise
// Natural Earth's adm1_code without its punctuation (SAH+00? -> SAH00).
function regionIds(units) {
  const counts = new Map();
  for (const unit of units) {
    if (mergedUnits[unit.properties.adm0_a3] != null) continue;
    const id = unit.properties.iso_3166_2;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return units.map((unit) => {
    const merged = mergedUnits[unit.properties.adm0_a3];
    if (merged != null) return merged.id;
    const id = unit.properties.iso_3166_2;
    return typeof id === "string" &&
      /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(id) &&
      counts.get(id) === 1
      ? id
      : unit.properties.adm1_code.replace(/[^A-Za-z0-9-]/g, "");
  });
}

function ringsOf(geometry) {
  if (geometry.type === "Polygon") return geometry.arcs;
  if (geometry.type === "MultiPolygon") return geometry.arcs.flat();
  return [];
}

// Simplification keeps arc endpoints only, so a small island drawn by one
// arc can lose all its other points. Such rings keep every point instead.
function simplifyKeepingRings(weighted, minWeight) {
  for (;;) {
    const simplified = simplify(weighted, minWeight);
    const collapsed = new Set();
    for (const geometry of simplified.objects.regions.geometries) {
      for (const ring of ringsOf(geometry)) {
        const points = new Set(
          ring.flatMap((ref) =>
            simplified.arcs[ref < 0 ? ~ref : ref].map(String),
          ),
        );
        if (points.size < 4)
          for (const ref of ring) collapsed.add(ref < 0 ? ~ref : ref);
      }
    }
    const kept = [...collapsed].filter((index) =>
      weighted.arcs[index].some((point) => point[2] !== Infinity),
    );
    if (kept.length === 0) return simplified;
    for (const index of kept)
      for (const point of weighted.arcs[index]) point[2] = Infinity;
  }
}

function wordsOf(name) {
  return name
    .replace(/[Đđ]/g, "D")
    .replace(/[Łł]/g, "L")
    .replace(/[Øø]/g, "O")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[^A-Za-z\s-]/g, "")
    .split(/[\s-]+/)
    .filter((word) => word.length > 0);
}

// The official short name, if there is one: the ISO 3166-2 subdivision code
// when it is all letters (MA for US-MA; codes with digits, such as GT-01,
// FR-2A or GR-A1, are not names), else Natural Earth's postal code when it is
// all letters and starts like the name (some are leftovers from older
// divisions).
function officialShortName(unit, id, words) {
  const merged = mergedUnits[unit.properties.adm0_a3];
  if (merged != null) return merged.short;
  const iso = /^[A-Z]{2}-([A-Z]{1,3})$/.exec(id)?.[1];
  if (iso != null) return iso;
  const postal = unit.properties.postal ?? "";
  if (/^[A-Z]{1,4}$/.test(postal) && postal[0] === words[0]?.[0]?.toUpperCase())
    return postal;
  return null;
}

// Short names, unique within a country and letters only (never a digit):
// the official short name; else, for a one-word name, its first three
// letters (Aisne -> Ais), then four, and so on; else the initials of the
// name (Rio Grande do Sul -> RGDS), then the first two letters of the first
// word (Ri), three, and so on; else the first of those with a letter added.
function shortNames(units, ids) {
  const names = units.map(
    (unit, i) =>
      mergedUnits[unit.properties.adm0_a3]?.name ??
      unit.properties.name ??
      ids[i],
  );
  const words = names.map(wordsOf);
  const result = units.map(() => null);
  const used = new Set();
  // Officials first, in id order (a taken one falls back to the rule
  // below), then the rest in id order, so the result is stable.
  for (const i of ids
    .map((id, i) => i)
    .sort((a, b) => ids[a].localeCompare(ids[b]))) {
    const official = officialShortName(units[i], ids[i], words[i]);
    if (official != null && !used.has(official)) {
      result[i] = official;
      used.add(official);
    }
  }
  const order = ids
    .map((id, i) => i)
    .filter((i) => result[i] == null)
    .sort((a, b) => ids[a].localeCompare(ids[b]));
  for (const i of order) {
    const list = words[i].length > 0 ? words[i] : ["X"];
    const first = list[0];
    // The first n letters of the first word, the first one a capital.
    const prefix = (n) =>
      first[0].toUpperCase() + first.slice(1, n).toLowerCase();
    const longer = (from) =>
      Array.from({ length: Math.max(0, first.length - from + 1) }, (_, n) =>
        prefix(from + n),
      );
    const candidates =
      list.length === 1
        ? // One word: its first three letters (Bayern -> Bay), then more.
          [prefix(3), ...longer(4)]
        : [list.map((word) => word[0].toUpperCase()).join(""), ...longer(2)];
    let short = candidates.find((candidate) => !used.has(candidate));
    for (let n = 0; short == null; n += 1) {
      const suffix = String.fromCharCode(97 + (n % 26)).repeat(
        Math.floor(n / 26) + 1,
      );
      if (!used.has(`${candidates[0]}${suffix}`))
        short = `${candidates[0]}${suffix}`;
    }
    used.add(short);
    result[i] = short;
  }
  return result;
}

function countryFeatures(units) {
  const ids = regionIds(units);
  const shorts = shortNames(units, ids);
  const features = units
    .map((unit, i) => ({
      type: "Feature",
      properties: {
        i: ids[i],
        n:
          mergedUnits[unit.properties.adm0_a3]?.name ??
          unit.properties.name ??
          ids[i],
        s: shorts[i],
      },
      geometry: rewind(unit.geometry),
    }))
    .sort((a, b) => a.properties.i.localeCompare(b.properties.i));
  return features;
}

function buildLevel(code, features, { minWeight, quantization }) {
  // Simplify in degrees (weights in steradians), then quantize.
  const weighted = presimplify(
    topology({
      regions: {
        type: "FeatureCollection",
        features: structuredClone(features),
      },
    }),
    sphericalTriangleArea,
  );
  const topo = quantize(
    simplifyKeepingRings(weighted, minWeight),
    quantization,
  );
  // Units merged into one region (Hong Kong's districts) are dissolved.
  const byId = new Map();
  for (const geometry of topo.objects.regions.geometries) {
    const group = byId.get(geometry.properties.i);
    if (group) group.push(geometry);
    else byId.set(geometry.properties.i, [geometry]);
  }
  topo.objects.regions.geometries = [...byId.values()].map((group) =>
    group.length === 1
      ? group[0]
      : { ...mergeArcs(topo, group), properties: group[0].properties },
  );
  // Quantization and simplification can collapse a tiny island or lake to
  // nothing, or flip a tiny island inside out (covering the globe). Drop
  // those polygons and holes; a region must keep at least one polygon.
  let dropped = 0;
  const removed = [];
  topo.objects.regions.geometries = topo.objects.regions.geometries.filter(
    (geometry) => {
      delete geometry.id;
      const polygons =
        geometry.type === "Polygon" ? [geometry.arcs] : geometry.arcs;
      const kept = polygons.flatMap((rings) => {
        const area = (arcs) =>
          geoArea(feature(topo, { type: "Polygon", arcs }));
        const exterior = area([rings[0]]);
        if (exterior === 0 || exterior > 2 * Math.PI) {
          dropped += 1;
          return [];
        }
        const holes = rings.slice(1).filter((ring) => {
          const inside = 4 * Math.PI - area([ring]);
          const keep = inside > 0 && inside < exterior;
          if (!keep) dropped += 1;
          return keep;
        });
        return [[rings[0], ...holes]];
      });
      if (kept.length === 0) {
        removed.push(geometry.properties.n);
        return false;
      }
      geometry.type = "MultiPolygon";
      geometry.arcs = kept;
      return true;
    },
  );
  if (dropped > 0 && process.env.VERBOSE)
    console.log(`${code}: dropped ${dropped} collapsed rings`);
  return { topo, removed };
}

const header = [
  "/* prettier-ignore */",
  "// AUTO-GENERATED by lib/scripts/build-regions.mjs - do not edit.",
  `// Source: Natural Earth 10m Admin 1 ${sourceVersion} (public domain).`,
];
const fileOf = (data) =>
  [...header, `module.exports = ${JSON.stringify(data)};`, ""].join("\n");
const round = (value, up) =>
  (up ? Math.ceil(value * 100) : Math.floor(value * 100)) / 100;

// Splits a level into chunks of nearby regions, each at most `chunkSize`
// bytes (or a single region), with its bounds in degrees.
function chunksOf(topo, quantization) {
  const all = feature(topo, topo.objects.regions).features;
  const encode = (features) =>
    quantize(
      topology({ regions: { type: "FeatureCollection", features } }),
      quantization,
    );
  const chunks = [];
  const split = (features) => {
    const chunkTopo = encode(features);
    for (const geometry of chunkTopo.objects.regions.geometries)
      delete geometry.id;
    if (
      features.length === 1 ||
      JSON.stringify(chunkTopo).length <= chunkSize
    ) {
      const [[west, south], [east, north]] = geoBounds({
        type: "FeatureCollection",
        features,
      });
      chunks.push({
        topo: chunkTopo,
        bounds: [
          round(west),
          round(south),
          round(east, true),
          round(north, true),
        ],
      });
      return;
    }
    // Halve along the longer side of the chunk, by region centroid.
    const centroids = features.map((f) => geoCentroid(f));
    const longitudes = centroids.map(([lon]) => lon);
    const latitudes = centroids.map(([, lat]) => lat);
    const axis =
      Math.max(...longitudes) - Math.min(...longitudes) >
      Math.max(...latitudes) - Math.min(...latitudes)
        ? 0
        : 1;
    const order = features
      .map((f, i) => [f, centroids[i][axis]])
      .sort((a, b) => a[1] - b[1])
      .map(([f]) => f);
    const half = Math.ceil(order.length / 2);
    split(order.slice(0, half));
    split(order.slice(half));
  };
  split(all);
  return chunks;
}

function buildCountry(code, units) {
  const features = countryFeatures(units);
  const built = levels.map((level) => buildLevel(code, features, level));
  const files = new Map();
  const index = [];
  for (const [level, { topo }] of built.entries()) {
    if (level === 0) continue;
    const chunks = chunksOf(topo, levels[level].quantization);
    index[level - 1] = chunks.map(({ bounds }) => bounds);
    chunks.forEach(({ topo: chunkTopo }, n) =>
      files.set(`${code}-${level}-${n}`, fileOf(chunkTopo)),
    );
  }
  // Level 0 also lists the chunks of levels 1 and 2, by bounds.
  files.set(code, fileOf({ topology: built[0].topo, chunks: index }));
  return {
    files,
    topo: built[1].topo,
    regionCount: built[2].topo.objects.regions.geometries.length,
    removed: built[2].removed,
  };
}

function buildLoaders(entries, names) {
  const lines = [
    "/* prettier-ignore */",
    "// AUTO-GENERATED by lib/scripts/build-regions.mjs - do not edit.",
    "// Static import() calls, so bundlers emit each file as its own chunk.",
    "// @ts-nocheck -- the .cjs data files have no type declarations.",
    'import type { RegionCountryInfo, RegionLoader } from "./store.js";',
    "",
    "// One file per country (level 0), and the chunks of levels 1 and 2.",
    "export const regionLoaders: Readonly<Record<string, RegionLoader>> = {",
    ...entries.flatMap(([, { files }]) =>
      [...files.keys()]
        .sort()
        .map(
          (name) =>
            `  ${JSON.stringify(name)}: () => import("./regions/${name}.cjs"),`,
        ),
    ),
    "};",
    "",
    "export const regionCountries: Readonly<Record<string, RegionCountryInfo>> = {",
    ...entries.map(
      ([code, { regionCount }]) =>
        `  ${JSON.stringify(code)}: { name: ${JSON.stringify(names.get(code))}, regionCount: ${regionCount} },`,
    ),
    "};",
    "",
  ];
  return lines.join("\n");
}

// A point inside a polygon: the middle of the widest inside stretch of the
// parallel through its centroid (the centroid can fall outside a curved
// region such as Odesa Oblast).
function interiorPoint(polygon) {
  const [, latitude] = geoCentroid(polygon);
  const crossings = [];
  for (const ring of polygon.coordinates) {
    for (let i = 1; i < ring.length; i += 1) {
      const [x1, y1] = ring[i - 1];
      const [x2, y2] = ring[i];
      if (y1 > latitude !== y2 > latitude)
        crossings.push(x1 + ((latitude - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  crossings.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const width = crossings[i + 1] - crossings[i];
    if (best == null || width > best.width)
      best = { width, x: (crossings[i] + crossings[i + 1]) / 2 };
  }
  return best == null ? geoCentroid(polygon) : [best.x, latitude];
}

// Each region must lie in the country that react-svg-worldmap's detailed
// tier draws it in, so the two layers agree (Crimea included). Checked with
// a point of the region's largest polygon.
function checkAlignment(entries) {
  const require = createRequire(import.meta.url);
  const detailed = require(
    path.join(
      path.dirname(require.resolve("react-svg-worldmap")),
      "map-assets/countries-detailed.cjs",
    ),
  );
  const countries = feature(detailed, detailed.objects.countries).features;
  const mismatches = [];
  for (const [code, { topo }] of entries) {
    const own = countries.find((country) => country.properties.I === code);
    for (const region of feature(topo, topo.objects.regions).features) {
      const largest = region.geometry.coordinates
        .map((coordinates) => ({ type: "Polygon", coordinates }))
        .sort((a, b) => geoArea(b) - geoArea(a))[0];
      const point = interiorPoint(largest);
      if (own != null && geoContains(own, point)) continue;
      const owner = countries.find((country) => geoContains(country, point));
      if (owner == null) continue; // A point in the sea: coastal shapes.
      mismatches.push(
        `${code} ${region.properties.i} (${region.properties.n}) is drawn in ${owner.properties.I}`,
      );
    }
  }
  return mismatches;
}

const source = await readSource();
const { byCountry, omitted, names } = groupByCountry(source);

const ukraine = byCountry.get("UA") ?? [];
for (const id of Object.keys(crimea)) {
  if (!ukraine.some((unit) => unit.properties.iso_3166_2 === id))
    throw new Error(`${id} is not a region of Ukraine`);
}
for (const [code, units] of byCountry) {
  if (
    code !== "UA" &&
    units.some((unit) => crimea[unit.properties.iso_3166_2] != null)
  )
    throw new Error(`Crimea is assigned to ${code}`);
}

const entries = [...byCountry.keys()]
  .sort()
  .map((code) => [code, buildCountry(code, byCountry.get(code))]);
const outputs = new Map(
  entries.flatMap(([, { files }]) =>
    [...files].map(([name, text]) => [`${name}.cjs`, text]),
  ),
);
const removed = entries.flatMap(([code, entry]) =>
  entry.removed.map((name) => `${code}: ${name}`),
);
if (removed.length > 0)
  console.log(`Too small to draw, left out: ${removed.join(", ")}`);
const mismatches = checkAlignment(entries);
if (mismatches.length > 0)
  throw new Error(`Regions outside their country:\n${mismatches.join("\n")}`);
const loaders = buildLoaders(entries, names);

if (omitted.size > 0) {
  console.log(
    `Left out (country not on the map): ${[...omitted]
      .map(([name, count]) => `${name} x${count}`)
      .join(", ")}`,
  );
}

if (check) {
  const stale = [];
  const existing = existsSync(regionsDir)
    ? readdirSync(regionsDir).filter((file) => file.endsWith(".cjs"))
    : [];
  for (const file of existing) if (!outputs.has(file)) stale.push(file);
  for (const [file, text] of outputs) {
    const target = path.join(regionsDir, file);
    if (!existsSync(target) || readFileSync(target, "utf8") !== text)
      stale.push(file);
  }
  if (!existsSync(loadersPath) || readFileSync(loadersPath, "utf8") !== loaders)
    stale.push("loaders.ts");
  if (stale.length > 0) {
    console.error(
      `Region data is out of date (${stale.slice(0, 10).join(", ")}${
        stale.length > 10 ? ", ..." : ""
      }). Run: yarn build:data`,
    );
    process.exit(1);
  }
  console.log(
    `Region data is up to date (${entries.length} countries, ${outputs.size} files).`,
  );
} else {
  rmSync(regionsDir, { recursive: true, force: true });
  mkdirSync(regionsDir, { recursive: true });
  let total = 0;
  for (const [file, text] of outputs) {
    writeFileSync(path.join(regionsDir, file), text, "utf8");
    total += Buffer.byteLength(text);
  }
  writeFileSync(loadersPath, loaders, "utf8");
  const regionTotal = entries.reduce((sum, [, e]) => sum + e.regionCount, 0);
  console.log(
    `Wrote ${entries.length} countries, ${regionTotal} regions, ${outputs.size} files, ${(
      total /
      1024 /
      1024
    ).toFixed(2)} MB`,
  );
}

// Short names must be letters only.
for (const [, { files }] of entries)
  for (const [name, text] of files)
    for (const match of text.matchAll(/"s":"([^"]*)"/g))
      if (!/^[A-Za-z]+$/.test(match[1]))
        throw new Error(
          `${name}: short name "${match[1]}" is not letters only`,
        );
