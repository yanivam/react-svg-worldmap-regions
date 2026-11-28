# react-svg-worldmap-regions [![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![npm version](https://img.shields.io/npm/v/react-svg-worldmap-regions.svg?style=flat)](https://www.npmjs.com/package/react-svg-worldmap-regions)

States, provinces and other regions for [react-svg-worldmap](https://github.com/yanivam/react-svg-worldmap). Zoom in on a country and the map draws its regions.

- **Optional.** `react-svg-worldmap` works the same with or without this package. Nothing changes until you pass the provider to a map.
- **Loads only what is needed.** The data comes in three levels of detail. Below zoom 8 the map loads one small file per country in view; above it, only the chunks (about 48 kB each) of the part in view, in more detail from zoom 24. Each file is its own chunk in your bundler, downloads the first time it is needed (or while the browser is idle, one zoom step before it is needed), and is decoded once. Zooming into Europe at 4x loads 0.8 MB instead of 4.1 MB with a single level.
- **Local data.** No map service and no network requests other than your own app's chunks.
- **Regions that govern.** By default, only regions with their own government between the country and its municipalities: 2,282 regions in 113 countries, such as US states, Italian regions or Kenyan counties. Countries without such a level, such as Israel or Ireland, have none. `tier: "all"` gives every first-level division instead: 4,139 regions in 175 countries. See [Tiers](#tiers).
- **Open data**, mostly public domain (Natural Earth), detailed enough for zoom 64x. The package is 6.0 MB (17.4 MB unpacked, 795 files); an app downloads only the files for what its users look at.

## Install

```bash
npm install react-svg-worldmap react-svg-worldmap-regions
```

Works with `react-svg-worldmap` `^2.7.0` and `^3.0.0`.

## Usage

```tsx
import WorldMap from "react-svg-worldmap";
import { createRegionsDetailProvider } from "react-svg-worldmap-regions";

// Create the provider once, outside the component.
const regions = createRegionsDetailProvider();

export default function App() {
  return (
    <WorldMap
      data={[{ country: "us", value: 1 }]}
      size="responsive"
      zoom
      detailLevel="regions"
      detailProvider={regions}
    />
  );
}
```

Regions appear at zoom level 4 and above, for the countries in view. Change that with `zoom={{ regionDetailMinScale: 3 }}`. With react-svg-worldmap 3.0.0, add `theme="atlasLight"` for pale water inside the globe and fine solid region borders, and `zoom={{ maxScale: 64, showRegionLabels: true }}` to zoom deeper and name the regions: the long name where it fits, the short one (MA for Massachusetts) where it does not. `regionLabelFormat: "long"` or `"short"` picks one.

## API

| Export | Description |
| --- | --- |
| `createRegionsDetailProvider(options?)` | A `detailProvider` for `<WorldMap detailLevel="regions" />`. `options.tier` is `"governing"` (default) or `"all"`; `options.countries` limits it to these ISO codes; `options.exclude` leaves countries out. |
| `loadRegionCollection(countryCode, options?)` | Loads one country's regions (`RegionCollection`, GeoJSON in longitude / latitude). `options.level` is the level of detail (0, 1 or 2; default 2), `options.bounds` keeps only the part within `[west, south, east, north]`, `options.tier` picks the tier. `undefined` for a country without regions. |
| `preloadRegions(countryCodes, options?)` | Starts loading these countries ahead of time (`options.level`, default 0; `options.tier`). |
| `hasRegions(countryCode, tier?)` | Whether the package has regions for a country in a tier (default `"governing"`). Loads nothing. |
| `regionCountryCodes`, `regionCountries` | The countries with governing-tier regions, and each one's name, region count and source. Load nothing. |
| `allRegionCountryCodes`, `allRegionCountries` | The same for `tier: "all"`. |
| `sourceSummary`, `sourceUrl` | Attribution text and link for the Natural Earth data. Each `RegionCollection` has its own, for the countries from geoBoundaries. |

Every region has a `name` and a `shortName`, worked out when the data is built (the package only reads them). Short names are unique within a country and never just a number:

1. the official short name: the ISO 3166-2 code when it has letters (MA for Massachusetts, BY for Bayern), else Natural Earth's postal code;
2. else, for a one-word name, its first three letters, the first a capital (Bayern without its code would be Bay; Aisne: Ais), then four, and so on;
3. else the initials of the name (Rio Grande do Sul: RGDS), then the first two letters of the first word (Ri), three, and so on.

Short names are letters only, never digits.

Region ids are ISO 3166-2 codes (`US-CA`, `UA-43`) where the source has one, else Natural Earth's own `adm1_code`, or the country code and the name (`IT-ABRUZZO`) for merged regions without one. Each region path carries `data-region-id`, `data-region-name` and `data-country-code`.

## Tiers

Natural Earth's admin-1 layer, the usual source of "states and provinces", has the first level of division of every country, whether or not anyone governs it: Israel's districts are statistical, Kenya's provinces were abolished in 2013, and England's admin-1 units are its 152 local councils. So the package has two tiers:

- `"governing"` (default): only a level of government between the country and its municipalities, as counted by the OECD–UCLG [World Observatory on Subnational Government Finance and Investment](https://www.sng-wofi.org/data/) (SNG-WOFI) and, for the 45 countries it does not cover, national sources. Italy has its 20 regions (not its 110 provinces), the United Kingdom has Scotland, Wales and Northern Ireland, Portugal has the Azores and Madeira, and Israel, Ireland and 60 other countries have no regions.
- `"all"`: every Natural Earth admin-1 unit.

```tsx
const regions = createRegionsDetailProvider({ tier: "all" });
```

[docs/governing-tier.md](docs/governing-tier.md) lists every country with both counts and the reason.

## Map data

| Source | Used for | License |
| --- | --- | --- |
| [Natural Earth 1:10m Admin 1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) v5.1.2 | All regions, except the five countries below | Public domain |
| [geoBoundaries](https://www.geoboundaries.org/) (Runfola et al. 2020) | The governing tier of Kenya, Nepal, Bangladesh, Côte d'Ivoire and Senegal, whose Natural Earth divisions were replaced | Public domain (Kenya), CC BY 3.0 IGO (Nepal, Bangladesh, Senegal), CC BY 4.0 (Côte d'Ivoire) |
| [SNG-WOFI](https://www.sng-wofi.org/data/) (OECD and UCLG), 2020 | Which countries have a governing tier (nothing from it is shipped) | Reference only |

If your app shows the regions of the five geoBoundaries countries, credit geoBoundaries and the country's source, as given in that country's `RegionCollection.sourceSummary` and in [docs/map-data.md](docs/map-data.md#sources).

The regions follow react-svg-worldmap's [map data policy](https://github.com/yanivam/react-svg-worldmap/blob/main/docs/map-data-policy.md); see [docs/map-data.md](docs/map-data.md) for how this package applies it. In short:

- Every region belongs to a country the map draws, and lies inside that country's border on the map. The build checks this for every region, in both tiers.
- Crimea (UA-43) and Sevastopol (UA-40) are regions of Ukraine.
- Countries and territories the map does not draw (Andorra, Malta, Singapore and other small states and islands) have no regions.

The map is a thematic visualization, not a legal boundary reference.

## Development

```bash
yarn install
yarn build:data     # regenerate lib/src/regions (downloads 41 MB from Natural Earth and 65 MB from geoBoundaries once)
yarn test
yarn build
yarn start:website  # the example, at http://localhost:5173
```

The generated files in `lib/src/regions/`, `lib/src/loaders.ts` and `docs/governing-tier.md` are committed; CI checks that they match the generator. Which tier each country has is in `lib/data/governing-tiers.json`.

## License

MIT for the code. The map data is public domain (Natural Earth), except the regions of Nepal, Bangladesh, Senegal (CC BY 3.0 IGO) and Côte d'Ivoire (CC BY 4.0) from geoBoundaries; see [Map data](#map-data).
