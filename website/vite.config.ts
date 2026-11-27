import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // The largest chunks are map data that loads only when zoomed in (the
    // detailed country borders and each country's regions).
    chunkSizeWarningLimit: 3000,
  },
});
