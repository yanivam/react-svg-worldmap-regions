# react-svg-worldmap-regions [![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![npm version](https://img.shields.io/npm/v/react-svg-worldmap-regions.svg?style=flat)](https://www.npmjs.com/package/react-svg-worldmap-regions)

States, provinces and other first-level regions (admin-1) for [react-svg-worldmap](https://github.com/yanivam/react-svg-worldmap). Zoom in on a country and the map draws its regions.

- **Optional.** `react-svg-worldmap` works the same with or without this package. Nothing changes until you pass the provider to a map.
- **Loads only what is needed.** Each country is a separate file that your bundler emits as its own chunk. It downloads the first time the map is zoomed in on that country, and never before.
- **Local data.** No map service and no network requests other than your own app's chunks.
- **4,139 regions in 175 countries**, from Natural Earth (public domain), about 2.2 MB in total and 1 to 130 kB per country.

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

Regions appear at zoom level 4 and above, for the countries in view. Change that with `zoom={{ regionDetailMinScale: 3 }}`. Try it with `theme="atlas"`, which draws region borders as fine solid lines (react-svg-worldmap 3.0.0 and later).

## API

| Export | Description |
| --- | --- |
| `createRegionsDetailProvider(options?)` | A `detailProvider` for `<WorldMap detailLevel="regions" />`. `options.countries` limits it to these ISO codes; `options.exclude` leaves countries out. |
| `loadRegionCollection(countryCode)` | Loads one country's regions (`RegionCollection`, GeoJSON in longitude / latitude), or `undefined` for a country without regions. |
| `preloadRegions(countryCodes)` | Starts loading these countries ahead of time. |
| `hasRegions(countryCode)` | Whether the package has regions for a country. Loads nothing. |
| `regionCountryCodes`, `regionCountries` | The countries with regions, and each one's name and region count. Load nothing. |
| `sourceSummary`, `sourceUrl` | Attribution text and link for the data. |

Region ids are ISO 3166-2 codes (`US-CA`, `UA-43`) where Natural Earth has one, and Natural Earth's own `adm1_code` otherwise. Each region path carries `data-region-id`, `data-region-name` and `data-country-code`.

## Map data

The regions come from [Natural Earth 1:10m Admin 1 – States, Provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) v5.1.2, which is in the public domain. They follow react-svg-worldmap's [map data policy](https://github.com/yanivam/react-svg-worldmap/blob/main/docs/map-data-policy.md); see [docs/map-data.md](docs/map-data.md) for how this package applies it. In short:

- Every region belongs to a country the map draws, and lies inside that country's border on the map. The build checks this for every region.
- Crimea (UA-43) and Sevastopol (UA-40) are regions of Ukraine.
- Countries and territories the map does not draw (Andorra, Malta, Singapore and other small states and islands) have no regions.

The map is a thematic visualization, not a legal boundary reference.

## Development

```bash
yarn install
yarn build:data     # regenerate lib/src/regions from Natural Earth (downloads 41 MB once)
yarn test
yarn build
yarn start:website  # the example, at http://localhost:5173
```

The generated files in `lib/src/regions/` and `lib/src/loaders.ts` are committed; CI checks that they match the generator.

## License

MIT. The map data is public domain (Natural Earth).
