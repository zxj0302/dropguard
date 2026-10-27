/**
 * DropGuard Background Service Worker (Manifest V3)
 * 
 * 1. Proxies cross-origin API requests from Content Script to bypass
 *    webpage Content Security Policy (connect-src) and HTTPS/HTTP Mixed Content blocks.
 * 2. Listens to toolbar action clicks to toggle the on-page DropGuard drawer.
 */

// 1. Toolbar Action Listener
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_DRAWER' }).catch(() => {
      // Content script may not be present on privileged URLs (chrome://, etc.)
    });
  }
});

// Allowed backend API origins whitelist to prevent SSRF and arbitrary network proxying.
// Only https origins are allowed (plain http is limited to loopback hosts for local development),
// so the Device ID can never be sent in clear text over the network.
import { BUILD_API_BASE_URL, isSecureApiUrl } from '../config';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'https://api.dropguard.io',
  'https://dropguard.io',
];

const FETCH_TIMEOUT_MS = 15000;
const ALLOWED_METHODS = new Set(['GET', 'POST']);
const ALLOWED_REQUEST_HEADERS = new Set(['content-type', 'x-device-id']);

async function isAllowedApiUrl(urlString: string): Promise<boolean> {
  try {
    const targetUrl = new URL(urlString);
    if (!isSecureApiUrl(urlString)) {
      return false;
    }

    // Allow official DropGuard production domains & subdomains dynamically (https only, enforced above)
    const hostname = targetUrl.hostname.toLowerCase();
    if (hostname === 'dropguard.io' || hostname.endsWith('.dropguard.io')) {
      return true;
    }

    const allowedOrigins = new Set<string>(DEFAULT_ALLOWED_ORIGINS);

    // The build-time configured API base URL is trusted
    try {
      if (isSecureApiUrl(BUILD_API_BASE_URL)) allowedOrigins.add(new URL(BUILD_API_BASE_URL).origin);
    } catch {
      // ignore
    }

    // Also include custom configured API base URL if persisted in chrome.storage.local
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get('dropguard_api_base');
        if (stored?.dropguard_api_base && typeof stored.dropguard_api_base === 'string') {
          if (isSecureApiUrl(stored.dropguard_api_base)) {
            allowedOrigins.add(new URL(stored.dropguard_api_base).origin);
          }
        }
      }
    } catch {
      // Ignore storage retrieval error
    }

    return allowedOrigins.has(targetUrl.origin);
  } catch {
    return false;
  }
}

/** Reduces caller-supplied fetch options to a strict whitelist (method, two headers, string body). */
function sanitizeFetchOptions(options: any): RequestInit {
  const method = typeof options?.method === 'string' ? options.method.toUpperCase() : 'GET';
  const safe: RequestInit = {
    method: ALLOWED_METHODS.has(method) ? method : 'GET',
    credentials: 'omit',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  };
  const headers: Record<string, string> = {};
  if (options?.headers && typeof options.headers === 'object') {
    for (const [k, v] of Object.entries(options.headers as Record<string, unknown>)) {
      if (ALLOWED_REQUEST_HEADERS.has(k.toLowerCase()) && typeof v === 'string') headers[k] = v;
    }
  }
  safe.headers = headers;
  if (safe.method === 'POST' && typeof options?.body === 'string' && options.body.length <= 256 * 1024) {
    safe.body = options.body;
  }
  return safe;
}

// 2. Cross-Origin API Fetch Proxy & Serialized Device ID Generation
const DEVICE_ID_KEY = 'dropguard_device_id';
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_.-]{8,128}$/;

function isValidDeviceIdBg(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') return false;
  return DEVICE_ID_REGEX.test(trimmed);
}

function generateSafeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // ignore
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let bgDeviceIdPromise: Promise<string> | null = null;

async function getOrCreateDeviceIdBg(): Promise<string> {
  const stored = await chrome.storage.local.get(DEVICE_ID_KEY);
  const existing = stored?.[DEVICE_ID_KEY];
  if (isValidDeviceIdBg(existing)) {
    return existing.trim();
  }
  if (!bgDeviceIdPromise) {
    bgDeviceIdPromise = (async () => {
      const recheck = await chrome.storage.local.get(DEVICE_ID_KEY);
      const cand = recheck?.[DEVICE_ID_KEY];
      if (isValidDeviceIdBg(cand)) {
        return cand.trim();
      }
      const newId = generateSafeUUID();
      await chrome.storage.local.set({ [DEVICE_ID_KEY]: newId });
      return newId;
    })().finally(() => {
      bgDeviceIdPromise = null;
    });
  }
  return bgDeviceIdPromise;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_OR_CREATE_DEVICE_ID') {
    if (sender?.id !== chrome.runtime.id) {
      sendResponse({ deviceId: null, error: 'Untrusted message sender' });
      return false;
    }
    getOrCreateDeviceIdBg()
      .then((deviceId) => sendResponse({ deviceId }))
      .catch((err) => sendResponse({ deviceId: null, error: err?.message }));
    return true;
  }

  if (message?.type === 'FETCH_API') {
    // Only accept messages from this extension's own contexts (content scripts / pages)
    if (sender?.id !== chrome.runtime.id) {
      sendResponse({ ok: false, status: 403, statusText: 'Forbidden', error: 'Untrusted message sender' });
      return false;
    }
    (async () => {
      try {
        const { url, options } = message;

        if (!url || typeof url !== 'string') {
          sendResponse({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            error: 'Missing or invalid URL parameter',
          });
          return;
        }

        const isAllowed = await isAllowedApiUrl(url);
        if (!isAllowed) {
          sendResponse({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            error: 'Target URL is not in the allowed DropGuard API origin whitelist',
          });
          return;
        }

        const res = await fetch(url, sanitizeFetchOptions(options));

        const contentType = res.headers.get('content-type') || '';
        let data: any = null;
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => null);
        } else {
          data = await res.text().catch(() => '');
        }

        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });

        sendResponse({
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          headers,
          data,
        });
      } catch (err: any) {
        sendResponse({
          ok: false,
          status: 0,
          statusText: 'NetworkError',
          error: err?.message || 'Failed to fetch via extension proxy',
        });
      }
    })();

    return true; // Keep message channel open for asynchronous response
  }
});

