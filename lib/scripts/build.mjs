/**
 * Builds dist/: ESM (index.js), CJS (index.cjs) and bundled declarations
 * (index.d.ts, index.d.cts), plus the per-country region data
 * (regions/XX.cjs), which index.js and index.cjs load with import(), so
 * bundlers emit each country as its own chunk. Run from the lib directory.
 */
import { cpSync, rmSync } from "node:fs";
import { build } from "esbuild";
import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";

const external = ["react-svg-worldmap", "topojson-client"];

const regionsExternal = {
  name: "regions-external",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\.\/regions\/[^/]+\.cjs$/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

const common = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  platform: "neutral",
  target: "es2020",
  packages: "external",
  external,
  plugins: [regionsExternal],
};

rmSync("dist", { recursive: true, force: true });

await build({ ...common, format: "esm", outfile: "dist/index.js" });
await build({
  ...common,
  format: "cjs",
  mainFields: ["module", "main"],
  outfile: "dist/index.cjs",
});

const bundle = await rollup({
  input: "src/index.ts",
  external,
  plugins: [dts({ tsconfig: "tsconfig.json" })],
});
await bundle.write({ file: "dist/index.d.ts", format: "es" });
await bundle.close();
cpSync("dist/index.d.ts", "dist/index.d.cts");

cpSync("src/regions", "dist/regions", {
  recursive: true,
  filter: (source) => !source.endsWith(".d.cts"),
});
