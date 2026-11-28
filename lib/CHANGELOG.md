# react-svg-worldmap-regions

## 1.0.0

### Major Changes

- First release: states, provinces and other regions for react-svg-worldmap. By default only regions that govern (`tier: "governing"`): a level of government between the country and its municipalities, per the OECD–UCLG SNG-WOFI and national sources, 2,282 regions in 113 countries (Italy's 20 regions, the UK's three devolved nations, Kenya's 47 counties; none for countries such as Israel or Ireland). `tier: "all"` gives every Natural Earth admin-1 unit, 4,139 regions in 175 countries. Shapes from Natural Earth 1:10m Admin 1 v5.1.2 (public domain), and from geoBoundaries for Kenya, Nepal, Bangladesh, Côte d'Ivoire and Senegal (CC BY 3.0 IGO / CC BY 4.0 / public domain; see docs/map-data.md). One lazily loaded file per country in three levels of detail, detailed enough for zoom 64x. Below zoom 8 the map loads one small file per country; above it, only the chunks (about 48 kB) of the part in view, fetched while the browser is idle one zoom step before they are needed. Every region has a `name` and a short `shortName` (MA for Massachusetts). `createRegionsDetailProvider()` plugs into `<WorldMap detailLevel="regions" detailProvider={...} />` (react-svg-worldmap `^2.7.0 || ^3.0.0`). Crimea and Sevastopol are regions of Ukraine, and every region is checked to lie inside the country the map draws it in.
