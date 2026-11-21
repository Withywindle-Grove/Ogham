/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** This build's version (vite.config.ts `define`): the commit's short id and the build day, or "dev" outside Vercel and CI. */
declare const __APP_BUILD__: { id: string; date: string | null } | undefined;
