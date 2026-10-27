/**
 * Cloudflare Workers entrypoint.
 * Exposes only the fetch handler so none of the Node-specific exports from index.ts leak into the Workers runtime.
 */
import { app, type CloudflareBindings } from './index.js';

export default {
  fetch(request: Request, env: CloudflareBindings, ctx: unknown): Response | Promise<Response> {
    return app.fetch(request, env, ctx as any);
  },
};
