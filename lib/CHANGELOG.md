# react-svg-worldmap-regions

## 1.0.0

### Major Changes

- First release: states, provinces and other first-level regions (admin-1) for react-svg-worldmap, from Natural Earth 1:10m Admin 1 v5.1.2 (public domain). 4,139 regions in 175 countries, one lazily loaded file per country in three levels of detail, detailed enough for zoom 64x. Below zoom 8 the map loads one small file per country; above it, only the chunks (about 48 kB) of the part in view. Every region has a `name` and a short `shortName` (MA for Massachusetts). `createRegionsDetailProvider()` plugs into `<WorldMap detailLevel="regions" detailProvider={...} />` (react-svg-worldmap `^2.7.0 || ^3.0.0`). Crimea and Sevastopol are regions of Ukraine, and every region is checked to lie inside the country the map draws it in.
