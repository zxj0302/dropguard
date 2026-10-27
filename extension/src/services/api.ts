/**
 * API Service for DropGuard Backend Communication
 */

import { BUILD_API_BASE_URL, isSecureApiUrl } from '../config';

const DEFAULT_API_BASE_URL = BUILD_API_BASE_URL;

export interface QuotaInfo {
  limit: number;
  remaining: number;
  resetAt?: string;
  isExceeded: boolean;
  upgradeUrl?: string;
  isPro?: boolean;
}

export class QuotaExceededError extends Error {
  public quotaInfo: QuotaInfo;
  constructor(message: string, quotaInfo: QuotaInfo) {
    super(message);
    this.name = 'QuotaExceededError';
    this.quotaInfo = quotaInfo;
  }
}

export interface IpCheckResult {
  risk_level: 'SAFE' | 'WARNING' | 'DANGER';
  risk_score: number;
  detected_terms: Array<{
    term: string;
    matched_text: string;
    similarity: number;
    match_type: string;
    owner: string;
    category: string;
    lawsuit_risk: string;
    description: string;
  }>;
  summary: string;
  product_title_analyzed: string;
  checked_at: string;
}

export interface SourceFinderResult {
  search_keywords: string;
  profit_estimate: {
    retail_price: number;
    estimated_factory_cost_min: number;
    estimated_factory_cost_max: number;
    estimated_shipping_cost: number;
    estimated_gross_profit: number;
    estimated_gross_margin_percentage: number;
    currency: string;
  };
  direct_sourcing_links: {
    aliexpress: string;
    alibaba1688: string;
    taobao: string;
    google_lens?: string;
  };
  dropship_insights: {
    recommended_moq: number;
    typical_dispatch_time: string;
    suggested_ad_spend_cap: number;
    sourcing_channel_advice: string;
  };
  analyzed_at: string;
}

export async function getApiBaseUrl(): Promise<string> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get('dropguard_api_base');
      if (
        typeof res.dropguard_api_base === 'string' &&
        res.dropguard_api_base.trim() &&
        isSecureApiUrl(res.dropguard_api_base.trim())
      ) {
        return res.dropguard_api_base.trim().replace(/\/+$/, '');
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_API_BASE_URL.trim().replace(/\/+$/, '');
}

/**
 * Returns dynamic pricing & checkout URL using configured API base URL
 */
export async function getPricingUrl(deviceId: string, ref = 'plugin'): Promise<string> {
  const baseUrl = await getApiBaseUrl();
  return `${baseUrl}/pricing?deviceId=${encodeURIComponent(deviceId)}&ref=${encodeURIComponent(ref)}`;
}

/**
 * Minimal Response wrapper compatible with both native Fetch and Background Extension Proxy
 */
interface SafeFetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<any>;
  text: () => Promise<string>;
}

/**
 * Resilient fetch utility:
 * Proxies requests through background service worker (chrome.runtime.sendMessage)
 * to bypass host page CSP (connect-src) and HTTPS/HTTP mixed content restrictions on live Shopify stores.
 * Automatically falls back to native fetch if extension runtime is unavailable.
 */
async function safeFetch(url: string, options?: RequestInit): Promise<SafeFetchResponse> {
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function'
  ) {
    let resp: any = null;

    try {
      resp = await new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 16000);
        chrome.runtime.sendMessage(
          {
            type: 'FETCH_API',
            url,
            options: {
              method: options?.method || 'GET',
              headers: options?.headers as Record<string, string>,
              body: options?.body ? String(options.body) : undefined,
            },
          },
          (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError || !response) {
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      });
    } catch {
      // Messaging channel threw, proceed to native fetch fallback
      resp = null;
    }

    if (resp && typeof resp.status === 'number') {
      if (resp.status === 0) {
        // Background proxy confirmed the server is unreachable; do not attempt doomed native fetch
        throw new Error(
          resp.error ||
            'Cannot connect to DropGuard Radar Server. Please check your connection or that the API server is running.'
        );
      }

      const headerMap: Record<string, string> = resp.headers || {};
      return {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
        headers: {
          get: (name: string) => headerMap[name.toLowerCase()] || null,
        },
        json: async () => {
          if (resp.data !== undefined && resp.data !== null && resp.data !== '') {
            if (typeof resp.data === 'object') {
              return resp.data;
            }
            try {
              return JSON.parse(resp.data);
            } catch {
              return { error: 'INVALID_JSON', message: resp.data };
            }
          }
          if (resp.error) {
            return { error: resp.error, message: resp.error };
          }
          return {};
        },
        text: async () => {
          if (resp.data !== undefined && resp.data !== null && resp.data !== '') {
            return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
          }
          if (resp.error) {
            return String(resp.error);
          }
          return '';
        },
      };
    }
  }

  // Native fetch fallback
  const res = await fetch(url, options);
  let cachedText: string | null = null;
  const getRawText = async () => {
    if (cachedText === null) {
      cachedText = await res.text();
    }
    return cachedText;
  };

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: {
      get: (name: string) => res.headers.get(name),
    },
    json: async () => {
      const text = await getRawText();
      if (!text || !text.trim()) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { error: 'INVALID_JSON', message: text };
      }
    },
    text: async () => {
      return getRawText();
    },
  };
}

/**
 * Parses quota headers from standard responses.
 */
function extractQuotaHeaders(response: SafeFetchResponse | Response): QuotaInfo {
  const limitStr = response.headers.get('X-Quota-Limit');
  const remStr = response.headers.get('X-Quota-Remaining');
  const reset = response.headers.get('X-Quota-Reset') || undefined;
  const userTier = response.headers.get('X-User-Tier') || '';
  const isPro = userTier === 'PRO';

  const limit = limitStr ? parseInt(limitStr, 10) : 3;
  const remaining =
    remStr !== null && remStr !== undefined && !isNaN(parseInt(remStr, 10))
      ? parseInt(remStr, 10)
      : response.status === 402
      ? 0
      : limit;

  return {
    limit,
    remaining,
    resetAt: reset,
    isExceeded: !isPro && (response.status === 402 || (remStr !== null && remaining <= 0)),
    isPro,
  };
}

/**
 * Fetch current quota status without consuming an action.
 */
export async function fetchQuotaStatus(deviceId: string): Promise<QuotaInfo> {
  const baseUrl = await getApiBaseUrl();
  try {
    const res = await safeFetch(`${baseUrl}/api/v1/quota-status`, {
      method: 'GET',
      headers: {
        'X-Device-Id': deviceId,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const isPro = data.is_pro === true;
      return {
        limit: data.limit ?? 3,
        remaining: data.remaining ?? 0,
        isExceeded: !isPro && data.remaining === 0,
        isPro,
      };
    }
  } catch (err) {
    console.warn('[DropGuard API] Quota check failed', err);
  }

  return {
    limit: 3,
    remaining: 3,
    isExceeded: false,
    isPro: false,
  };
}

/**
 * Check product title for IP / trademark / patent threats.
 */
export async function runIpCheck(
  productTitle: string,
  deviceId: string,
  productImage?: string
): Promise<{ data: IpCheckResult; quota: QuotaInfo }> {
  const baseUrl = await getApiBaseUrl();

  try {
    const res = await safeFetch(`${baseUrl}/api/v1/ip-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify({
        product_title: productTitle,
        product_image: productImage,
      }),
    });

    if (res.status === 402) {
      const errData = await res.json().catch(() => ({}));
      throw new QuotaExceededError(errData.message || 'Daily free quota exceeded', {
        limit: errData.limit || 3,
        remaining: 0,
        isExceeded: true,
        resetAt: errData.reset_at,
        upgradeUrl: errData.upgrade_url,
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned HTTP ${res.status}: ${errText}`);
    }

    const quota = extractQuotaHeaders(res);
    const data: IpCheckResult = await res.json();
    return { data, quota };
  } catch (err: any) {
    if (err instanceof QuotaExceededError) throw err;
    throw new Error(err?.message || 'Failed to connect to DropGuard Radar Server');
  }
}

/**
 * Calculate factory cost bracket, margins and 1688/AliExpress sourcing links.
 */
export async function runSourceFinder(
  productTitle: string,
  deviceId: string,
  retailPrice?: number,
  productImage?: string,
  currency?: string
): Promise<{ data: SourceFinderResult; quota: QuotaInfo }> {
  const baseUrl = await getApiBaseUrl();

  const safePrice =
    typeof retailPrice === 'number' && Number.isFinite(retailPrice) && retailPrice > 0 && retailPrice <= 1_000_000
      ? Number(retailPrice.toFixed(2))
      : undefined;

  try {
    const res = await safeFetch(`${baseUrl}/api/v1/source-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify({
        product_title: productTitle,
        retail_price: safePrice,
        currency: currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : undefined,
        product_image: productImage,
      }),
    });

    if (res.status === 402) {
      const errData = await res.json().catch(() => ({}));
      throw new QuotaExceededError(errData.message || 'Daily free quota exceeded', {
        limit: errData.limit || 3,
        remaining: 0,
        isExceeded: true,
        resetAt: errData.reset_at,
        upgradeUrl: errData.upgrade_url,
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Server returned HTTP ${res.status}: ${errText}`);
    }

    const quota = extractQuotaHeaders(res);
    const data: SourceFinderResult = await res.json();
    return { data, quota };
  } catch (err: any) {
    if (err instanceof QuotaExceededError) throw err;
    throw new Error(err?.message || 'Failed to connect to DropGuard Radar Server');
  }
}

/**
 * Reset quota for local testing
 */
export async function resetDevQuota(deviceId: string): Promise<boolean> {
  const baseUrl = await getApiBaseUrl();
  try {
    const res = await safeFetch(`${baseUrl}/api/v1/reset-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
