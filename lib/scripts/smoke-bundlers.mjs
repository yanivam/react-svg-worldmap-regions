/**
 * Smoke test: bundle the packed package with Vite and webpack and check that
 * each country's regions (dist/regions/XX.cjs) become a chunk of their own,
 * kept out of the entry chunk, and that a chunk loads and decodes.
 *
 * Run from a directory that has react-svg-worldmap-regions,
 * react-svg-worldmap, react, react-dom, vite and webpack installed (CI
 * installs the packed tarball there).
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build as viteBuild } from "vite";
import webpack from "webpack";

const root = process.cwd();
const entry = path.join(root, "smoke-bundler-entry.mjs");

writeFileSync(
  entry,
  `import { createRegionsDetailProvider, regionCountryCodes } from "react-svg-worldmap-regions";

export async function run() {
  const result = await createRegionsDetailProvider().loadRegions("UA");
  if (result.status !== "ready") throw new Error(result.warning);
  return { countries: regionCountryCodes.length, regions: result.collection.regions.length };
}
`,
);

// One chunk per country, and an entry chunk without region data.
function checkChunks(outDir, bundler, entryFile) {
  const files = readdirSync(outDir).filter((file) => /\.(c|m)?js$/.test(file));
  const entrySize = statSync(path.join(outDir, entryFile)).size;
  if (files.length < 150 || entrySize > 1_000_000)
    throw new Error(
      `${bundler}: expected a chunk per country, got ${files.length} files (entry ${entrySize} bytes)`,
    );
  console.log(
    `${bundler}: ${files.length} chunks, entry ${(entrySize / 1024).toFixed(0)} KB`,
  );
}

async function runBundle(file, bundler) {
  const bundle = await import(pathToFileURL(file).href);
  const run = bundle.run ?? bundle.default?.run;
  const { countries, regions } = await run();
  if (countries < 150 || regions < 20)
    throw new Error(
      `${bundler}: got ${countries} countries, ${regions} regions`,
    );
  console.log(`${bundler}: Ukraine loaded (${regions} regions)`);
}

const viteOut = path.join(root, "dist-vite");
await viteBuild({
  root,
  logLevel: "warn",
  configFile: false,
  build: {
    outDir: viteOut,
    emptyOutDir: true,
    minify: false,
    lib: { entry, formats: ["es"], fileName: () => "main.mjs" },
  },
});
checkChunks(viteOut, "Vite", "main.mjs");
await runBundle(path.join(viteOut, "main.mjs"), "Vite");

function webpackBuild(target, outDir, extra = {}) {
  return new Promise((resolve, reject) => {
    webpack(
      {
        mode: "production",
        target,
        context: root,
        entry,
        output: { path: outDir, clean: true, ...extra },
        optimization: { minimize: false },
        performance: { hints: false },
      },
      (error, stats) => {
        if (error) return reject(error);
        if (stats.hasErrors())
          return reject(new Error(stats.toString("errors-only")));
        if (stats.hasWarnings())
          console.warn(stats.toString("errors-warnings"));
        return resolve();
      },
    );
  });
}
await webpackBuild("web", path.join(root, "dist-webpack-web"), {
  library: { type: "var", name: "smoke" },
});
checkChunks(path.join(root, "dist-webpack-web"), "webpack (web)", "main.js");
const webpackNodeOut = path.join(root, "dist-webpack-node");
await webpackBuild("node", webpackNodeOut, {
  filename: "main.cjs",
  chunkFilename: "[id].cjs",
  library: { type: "commonjs2" },
});
checkChunks(webpackNodeOut, "webpack (node)", "main.cjs");
await runBundle(path.join(webpackNodeOut, "main.cjs"), "webpack (node)");

console.log("Bundler smoke OK");
