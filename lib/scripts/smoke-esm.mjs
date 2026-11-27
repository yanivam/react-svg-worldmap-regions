/** Smoke test: ESM import of the packed package, and one country's regions. */
const pkg = await import("react-svg-worldmap-regions");
if (typeof pkg.createRegionsDetailProvider !== "function") {
  console.error("Expected createRegionsDetailProvider to be a function");
  process.exit(1);
}
const provider = pkg.createRegionsDetailProvider();
const result = await provider.loadRegions("UA");
const ids = result.collection?.regions.map((region) => region.id) ?? [];
if (result.status !== "ready" || !ids.includes("UA-43")) {
  console.error("Expected Ukraine's regions to include Crimea (UA-43)", result);
  process.exit(1);
}
console.log(`ESM smoke OK (${pkg.regionCountryCodes.length} countries)`);
