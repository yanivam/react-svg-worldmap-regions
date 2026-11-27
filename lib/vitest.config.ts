import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  esbuild: {
    tsconfigRaw: {
      compilerOptions: { jsx: "react", module: "esnext", target: "esnext" },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // Generated data, no logic to test.
      exclude: ["src/__tests__/**", "src/regions/**", "src/loaders.ts"],
      thresholds: { lines: 91, functions: 91, branches: 91, statements: 91 },
    },
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
});
