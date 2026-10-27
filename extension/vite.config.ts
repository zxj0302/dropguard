import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';
import { buildSync } from 'esbuild';

// API base URL is injected at build time (VITE_API_BASE_URL); defaults to the local dev server.
const apiBaseUrl = (
  process.env.VITE_API_BASE_URL ||
  loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'VITE_').VITE_API_BASE_URL ||
  'http://localhost:8787'
).trim().replace(/\/+$/, '');
const apiBaseDefine = { __DROPGUARD_API_BASE__: JSON.stringify(apiBaseUrl) };
console.log(`[build] API base URL: ${apiBaseUrl}`);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-manifest-and-assets',
      closeBundle() {
        if (!fs.existsSync('dist')) {
          fs.mkdirSync('dist', { recursive: true });
        }
        if (fs.existsSync('manifest.json')) {
          fs.copyFileSync('manifest.json', 'dist/manifest.json');
          console.log('[build] Copied manifest.json to dist/');
        }
        if (fs.existsSync('public/icons')) {
          fs.mkdirSync('dist/icons', { recursive: true });
          const icons = fs.readdirSync('public/icons');
          for (const icon of icons) {
            fs.copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
          }
          console.log(`[build] Copied ${icons.length} icon(s) to dist/icons/`);
        }
        if (fs.existsSync('src/background/index.ts')) {
          buildSync({
            entryPoints: ['src/background/index.ts'],
            outfile: 'dist/background.js',
            bundle: true,
            minify: true,
            format: 'iife',
            target: 'es2022',
            sourcemap: false,
            define: apiBaseDefine,
          });
          console.log('[build] Bundled background service worker to dist/background.js');
        }
      },
    },
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    ...apiBaseDefine,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false, // Security: Strictly disable source maps
    minify: 'terser', // Security: Industrial Terser obfuscation & minification
    terserOptions: {
      compress: {
        drop_debugger: true,
        drop_console: false, // Keep logs for runtime debugging while obfuscating identifiers
        passes: 2,
      },
      mangle: {
        toplevel: true, // Mangle top-level variable and function names
      },
      format: {
        comments: false, // Strip all license & inline comments
      },
    },
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        name: 'DropGuardContentScript',
      },
    },
  },
});
