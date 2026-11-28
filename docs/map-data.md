# Map data

This package follows react-svg-worldmap's [map data policy](https://github.com/yanivam/react-svg-worldmap/blob/main/docs/map-data-policy.md). It adds regions inside the countries that react-svg-worldmap draws; it does not change which country any land belongs to.

## Sources

| Source | Used for | License |
| --- | --- | --- |
| [Natural Earth 1:10m Admin 1 – States, Provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/), v5.1.2 | The shapes and names of all regions, except the five countries below | Public domain |
| [geoBoundaries](https://www.geoboundaries.org/) gbOpen ([Runfola et al. 2020](https://doi.org/10.1371/journal.pone.0231866)), snapshot `1c423398` | The governing tier of Kenya, Nepal, Bangladesh, Côte d'Ivoire and Senegal, where Natural Earth has divisions that were replaced | Per country, below |
| [OECD–UCLG World Observatory on Subnational Government Finance and Investment](https://www.sng-wofi.org/data/) (SNG-WOFI), 2020 values | Deciding which countries have a governing tier and what it is (no data from it is shipped) | Reference only |

The generator (`lib/scripts/build-regions.mjs`) downloads the Natural Earth GeoJSON from the `v5.1.2` tag of [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) and the geoBoundaries files from the pinned snapshot, and checks the SHA-256 of each before use. The pins and hashes are in the script and in [`lib/data/geoboundaries.json`](../lib/data/geoboundaries.json).

geoBoundaries files, and the attribution their licenses require:

| Country | File | License | Attribution |
| --- | --- | --- | --- |
| Kenya | `KEN-ADM1` | Public domain | geoBoundaries (Runfola et al. 2020); RCMRD GeoPortal, Africa GeoPortal |
| Nepal | `NPL-ADM1` | [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/) | geoBoundaries (Runfola et al. 2020); Survey Department of Nepal |
| Bangladesh | `BGD-ADM2` | [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/) | geoBoundaries (Runfola et al. 2020); Bangladesh Bureau of Statistics (BBS), OCHA ROAP |
| Côte d'Ivoire | `CIV-ADM2` | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | geoBoundaries (Runfola et al. 2020); World Bank |
| Senegal | `SEN-ADM2` | [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/) | geoBoundaries (Runfola et al. 2020); Government of Senegal, OCHA ROWCA |

Each of these countries' `RegionCollection` carries its source in `sourceSummary` and `sourceUrl`. Apps that show these countries' regions should show that attribution. The rest of the data is public domain and needs none.

Natural Earth marks its admin-1 layer as beta, and some region names and divisions are out of date. With `tier: "all"` they are shown as Natural Earth has them. Region names are English names.

## Tiers

A country's "regions" mean different things in different countries. Natural Earth's admin-1 layer has the first level of division of every country, whether or not it is a level of government: Israel's six districts are statistical, Kenya's eight provinces were abolished in 2013, and England's 152 local authorities are municipalities. Shown on a map as states and provinces, they mislead.

So the package has two tiers:

- **`governing` (the default).** Only a level of government between the country and its municipalities: states, provinces, regions or counties that have their own elected government, such as US states, German Länder, Italian regions or Kenyan counties. Countries without one (Israel, Ireland, Afghanistan and 59 others) have no regions. 113 countries, 2,282 regions.
- **`all`.** Every Natural Earth admin-1 unit, as in earlier builds: 175 countries, 4,139 regions.

Pass `tier: "all"` to `createRegionsDetailProvider`, `loadRegionCollection` or `preloadRegions`, and to `hasRegions` to ask about it.

How each country is classified:

1. **SNG-WOFI first.** It counts each country's regional, intermediate and municipal governments. A country with regional (or, when there are none, intermediate) governments has a governing tier; a country with municipalities only has none. It covers 130 of the 175 countries that have regions.
2. **National sources for the rest.** For the other 45 that SNG-WOFI does not cover, the tier comes from the country's constitution and laws on local government.
3. **Then the shapes.** When Natural Earth's units are that tier, they are kept as they are (92 countries). When they are smaller units of it, they are merged into it (11: Italy's 110 provinces into its 20 regions, the United Kingdom into Scotland, Wales and Northern Ireland, Norway's old counties into the 15 in force since 2024, and others). When only some units govern themselves, only those are kept (5: Georgia keeps Abkhazia, Adjara and Tbilisi; Portugal the Azores and Madeira). When Natural Earth has divisions that were replaced, the tier comes from geoBoundaries (5, above). The rest have no regions (62).

geoBoundaries regions are clipped to the country's Natural Earth outline (the union of its admin-1 units), which shares the map's country borders, so the alignment check below applies to them too.

Every country, its tier, its region counts and the reason are listed in [governing-tier.md](governing-tier.md), generated from [`lib/data/governing-tiers.json`](../lib/data/governing-tiers.json). Palestine is kept as two regions (West Bank, Gaza Strip) although SNG-WOFI lists municipalities only; that is a policy choice for the maintainers.

## Processing

1. Each Natural Earth unit is assigned to a react-svg-worldmap country by its ISO 3166-1 code, with the exceptions below.
2. The governing tier of each country is built from them as described under [Tiers](#tiers).
3. Each set of regions is built at three levels of detail (Visvalingam simplification, then quantization to a grid of each file's bounding box). Small islands keep their shape instead of disappearing.
   - Level 0, for zoom below 8: 10⁻⁶ steradians (a triangle of about 40 km²), 10,000 × 10,000 grid, one file per country.
   - Level 1, zoom 8 to 24: 10⁻⁷ steradians (about 4 km²), 100,000 × 100,000 grid.
   - Level 2, zoom 24 and above: 2.5 × 10⁻⁹ steradians (about 0.1 km²), 200,000 × 200,000 grid, enough for zoom 64.
   - Levels 1 and 2 are split into chunks of nearby regions of at most 48 kB (a single larger region stays whole), by halving along the longer side. The level-0 file lists each chunk's bounds, so the provider loads only the chunks in view.
4. **Alignment check.** For every region, in both tiers, a point inside its largest polygon must lie inside the same country in react-svg-worldmap's detailed (10m) country borders. The build fails otherwise. This keeps the region layer and the country layer in agreement on every boundary the map draws, disputed ones included.

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

Change the pinned version and SHA-256 in `lib/scripts/build-regions.mjs` (Natural Earth) or `lib/data/geoboundaries.json` (geoBoundaries), run `yarn build:data`, review the printed lists and the diff of `lib/src/loaders.ts` and `docs/governing-tier.md`, and record any new recognition-sensitive case above.

When a country's governing tier changes (a reform, new SNG-WOFI data), change its entry in `lib/data/governing-tiers.json`, with the source of the change, and run `yarn build:data`. The build fails if a country the map draws has no entry.
