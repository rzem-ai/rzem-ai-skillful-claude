import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

// electron-vite layout
//
//   electron/main      → main process (Node)
//   electron/preload   → preload script (Node, sandboxed bridge)
//   src/               → renderer (the existing Vue app, untouched)
//
// `externalizeDepsPlugin` keeps native/Node deps out of the main bundle
// (electron-updater, gray-matter, the spawned `skills` CLI, etc.) so they
// resolve from node_modules at runtime instead of being inlined.

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/main",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: ".",
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
    },
  },
});
