/** Smoke test: CJS require() of the packed package, and one country's regions. */
const pkg = require("react-svg-worldmap-regions");

if (typeof pkg.createRegionsDetailProvider !== "function") {
  console.error("Expected createRegionsDetailProvider to be a function", pkg);
  process.exit(1);
}
pkg
  .loadRegionCollection("US")
  .then((collection) => {
    if (!collection || collection.regions.length < 50)
      throw new Error("Expected at least 50 US regions");
    console.log(`CJS smoke OK (US: ${collection.regions.length} regions)`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
