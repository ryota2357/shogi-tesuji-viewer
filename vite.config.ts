import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// ビルド結果は dist/index.html 1 ファイルにまとめる（file:// で直接開ける）
export default defineConfig({
  base: "./",
  plugins: [preact(), viteSingleFile()],
});
