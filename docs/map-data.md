# Map data

This package follows react-svg-worldmap's [map data policy](https://github.com/yanivam/react-svg-worldmap/blob/main/docs/map-data-policy.md). It adds regions inside the countries that react-svg-worldmap draws; it does not change which country any land belongs to.

## Source

[Natural Earth 1:10m Admin 1 – States, Provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/), version 5.1.2, in the public domain. The generator (`lib/scripts/build-regions.mjs`) downloads the GeoJSON from the `v5.1.2` tag of [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) and checks its SHA-256 before use.

Natural Earth marks its admin-1 layer as beta, and some region names and divisions are out of date (for example, older province structures in a few countries). Region names are Natural Earth's English names. They are shown in `data-region-name` and in your own UI, not as labels on the map.

## Processing

1. Each Natural Earth unit is assigned to a react-svg-worldmap country by its ISO 3166-1 code, with the exceptions below.
2. Each country is simplified (Visvalingam, 10⁻⁷ steradians, a triangle of about 4 km², enough for zoom 16) and quantized to a 10,000 × 10,000 grid of its own bounding box. Small islands keep their shape instead of disappearing.
3. **Alignment check.** For every region, a point inside its largest polygon must lie inside the same country in react-svg-worldmap's detailed (10m) country borders. The build fails otherwise. This keeps the region layer and the country layer in agreement on every boundary the map draws, disputed ones included.

## Recognition-sensitive cases

The region layer inherits the country layer's choices. It never assigns a region to a different country than the one the map shows it in.

| Case | Regions | Why |
| --- | --- | --- |
| Crimea and Sevastopol | `UA-43` and `UA-40`, in Ukraine | Natural Earth's default view puts them in Russia; react-svg-worldmap draws them in Ukraine. The generator moves them and fails if they end up anywhere else. Tests check the published data. |
| Kashmir | India: `IN-JK`, `IN-LA`. Pakistan: `PK-JK`, `PK-GB`. Aksai Chin is part of China's regions. Siachen Glacier has no region. | Follows the lines of control that the map's country borders use. |
| Western Sahara | One region, `SAH00`, in Western Sahara (`EH`) | The map draws Western Sahara as its own area. Morocco's regions stay north of it. |
| Palestine | `PS-GZZ` (Gaza Strip), `PS-WBK` (West Bank) | As drawn by the map. |
| Kosovo, Taiwan, Northern Cyprus, Somaliland | Regions under the map's own codes (`XK`, `TW`, `CYP`, `SOM`) | As drawn by the map. |
| Hong Kong, Macau | One region each in China (`CN-HK`, `CN-MO`) | The map's detailed tier draws them as part of China. |
| Akrotiri, Dhekelia, Baikonur, Guantánamo Bay | One region each in Cyprus, Kazakhstan and Cuba | The map's detailed tier draws them inside those countries. |

Countries and territories that react-svg-worldmap does not draw (Andorra, Liechtenstein, Malta, Monaco, San Marino, Singapore, Vatican City, and small island states and territories) have no regions. The generator prints the full list on every run.

## Updating the data

Change the pinned version and SHA-256 in `lib/scripts/build-regions.mjs`, run `yarn build:data`, review the printed lists and the diff of `lib/src/loaders.ts`, and record any new recognition-sensitive case above.
