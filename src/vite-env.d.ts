/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * The configured application name.
   *
   * Declared here so `import.meta.env.VITE_APP_NAME` is a `string | undefined`
   * rather than the `any` the index signature would otherwise give it. The
   * value is resolved once, in `src/config/app.ts`.
   */
  readonly VITE_APP_NAME?: string;
}
