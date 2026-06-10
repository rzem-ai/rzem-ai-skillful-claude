/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// The slim Monaco entrypoint re-exports the same API as the package root,
// but the ESM subpath ships no type mapping — point it at the root types.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
}
