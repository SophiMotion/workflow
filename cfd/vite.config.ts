import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

function portableSingleFile(): Plugin {
  return {
    name: "sophiflow-portable-single-file",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const outputs = Object.values(bundle);
        const assets = outputs.filter((output) => output.type === "asset");
        const html = assets.find((output) => output.fileName === "index.html");
        const chunks = outputs.filter((output) => output.type === "chunk");
        const styles = assets.filter((output) => output.fileName.endsWith(".css"));
        const unsupportedAssets = assets.filter((output) => output !== html && !output.fileName.endsWith(".css"));

        if (!html) this.error("Portable build did not emit index.html");
        if (chunks.length !== 1) this.error(`Portable build expected one JavaScript chunk, received ${chunks.length}`);
        if (styles.length !== 1) this.error(`Portable build expected one stylesheet, received ${styles.length}`);
        if (unsupportedAssets.length > 0) {
          this.error(`Portable build still contains external assets: ${unsupportedAssets.map((asset) => asset.fileName).join(", ")}`);
        }

        const entry = chunks[0]!;
        const stylesheet = styles[0]!;
        const htmlSource = typeof html.source === "string" ? html.source : new TextDecoder().decode(html.source);
        const cssSource = typeof stylesheet.source === "string"
          ? stylesheet.source
          : new TextDecoder().decode(stylesheet.source);
        const scriptTags = htmlSource.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi) ?? [];
        const stylesheetTags = htmlSource.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi) ?? [];

        if (scriptTags.length !== 1) this.error(`Portable build expected one external entry script, received ${scriptTags.length}`);
        if (stylesheetTags.length !== 1) this.error(`Portable build expected one external stylesheet link, received ${stylesheetTags.length}`);

        html.source = htmlSource
          .replace(
            stylesheetTags[0]!,
            () => `<style>${cssSource.replace(/<\/style/gi, "<\\/style")}</style>`,
          )
          .replace(
            scriptTags[0]!,
            () => `<script type="module">${entry.code.replace(/<\/script/gi, "<\\/script")}</script>`,
          );

        for (const output of [...chunks, ...styles]) delete bundle[output.fileName];
      },
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), portableSingleFile()],
  worker: { format: "iife" },
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
