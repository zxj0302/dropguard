/// <reference types="vite/client" />

declare module '*?inline' {
  const content: string;
  export default content;
}


/** Build-time injected API base URL (see vite.config.ts / VITE_API_BASE_URL). */
declare const __DROPGUARD_API_BASE__: string;
