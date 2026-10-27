/**
 * Build-time configuration.
 * The API base URL is injected by vite.config.ts from the VITE_API_BASE_URL environment variable
 * (defaults to the local dev server http://localhost:8787 for development).
 */

declare const __DROPGUARD_API_BASE__: string | undefined;

export const BUILD_API_BASE_URL: string = (
  (typeof __DROPGUARD_API_BASE__ !== 'undefined' && __DROPGUARD_API_BASE__) || 'http://localhost:8787'
)
  .trim()
  .replace(/\/+$/, '');

/** True for loopback development hosts, where plain http is acceptable. */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * An API origin may be used if it is https, or plain http on a loopback host (local development).
 * Plain-http non-local origins are rejected to prevent downgrade/sniffing of the Device ID.
 */
export function isSecureApiUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && isLocalHostname(u.hostname);
  } catch {
    return false;
  }
}
