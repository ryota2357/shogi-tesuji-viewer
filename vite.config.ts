import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Bundle everything into dist/index.html so that it opens directly from file://
export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
});
