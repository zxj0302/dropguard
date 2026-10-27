/**
 * Shopify Store Detector
 * Combined Static DOM heuristic + Asynchronous same-origin endpoint probe
 * Designed specifically for MV3 Isolated World execution context.
 */

export interface ShopifyDetectionResult {
  isShopify: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedSignals: string[];
  themeName?: string;
  sampleProduct?: any;
}

/**
 * Perform synchronous static DOM feature detection.
 * Distinguishes between definitive strong signals and generic weak signals.
 */
export function detectShopifyStatic(): { isShopify: boolean; signals: string[]; hasStrongSignal: boolean } {
  const signals: string[] = [];
  let hasStrongSignal = false;

  // 1. Meta tag check: meta[property="og:platform"], meta[name="shopify-digital-wallet"]
  const ogPlatform = document.querySelector('meta[property="og:platform"]');
  if (ogPlatform && ogPlatform.getAttribute('content')?.toLowerCase().includes('shopify')) {
    signals.push('meta[property="og:platform"]');
    hasStrongSignal = true;
  }

  const shopifyDigitalWallet = document.querySelector('meta[name="shopify-digital-wallet"]');
  if (shopifyDigitalWallet) {
    signals.push('meta[name="shopify-digital-wallet"]');
    hasStrongSignal = true;
  }

  // 2. CDN asset links and scripts
  const cdnLinks = document.querySelector('link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"]');
  if (cdnLinks) {
    signals.push('cdn.shopify.com resource reference');
    hasStrongSignal = true;
  }

  // 3. Known Shopify script tags / IDs
  if (document.querySelector('script#shopify-features') || document.getElementById('shopify-features')) {
    signals.push('script#shopify-features element');
    hasStrongSignal = true;
  }

  if (document.querySelector('script#__st') || document.getElementById('__st')) {
    signals.push('script#__st tracking element');
    hasStrongSignal = true;
  }

  // 4. BOOMR Shopify analytics
  const boomr = document.querySelector('script[src*="boomerang"], script[src*="trekkie"]');
  if (boomr) {
    signals.push('Shopify analytics (trekkie/boomerang)');
    hasStrongSignal = true;
  }

  // 5. Specific Shopify cart form action (weak signal, must not trigger false positives alone)
  const cartForm = document.querySelector('form[action*="/cart/add"]');
  if (cartForm) {
    signals.push('form[action*="/cart/add"]');
  }

  return {
    isShopify: signals.length > 0,
    signals,
    hasStrongSignal,
  };
}

/**
 * Asynchronously probe same-origin /products.json?limit=1 endpoint.
 * Shopify stores expose this public storefront endpoint by default.
 */
export async function probeShopifyEndpoint(): Promise<{
  isShopify: boolean;
  sampleProduct?: any;
  error?: string;
}> {
  try {
    const endpoints = [
      `${window.location.origin}/products.json?limit=1`,
      `${window.location.origin}/collections/all/products.json?limit=1`,
    ];

    for (const probeUrl of endpoints) {
      let timeoutId: any = null;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(probeUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          cache: 'no-cache',
          signal: controller.signal,
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (data && Array.isArray(data.products)) {
              return {
                isShopify: true,
                sampleProduct: data.products[0] || null,
              };
            }
          }
        }
      } catch {
        // Try next endpoint fallback
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    return { isShopify: false };
  } catch (err: any) {
    return {
      isShopify: false,
      error: err?.message || 'Network probe failed',
    };
  }
}

/**
 * Main dual-layer Shopify detection function.
 */
export async function detectShopify(): Promise<ShopifyDetectionResult> {
  const staticResult = detectShopifyStatic();
  const isMyshopifyDomain = window.location.hostname.includes('myshopify.com');

  // If no static signals detected and not a *.myshopify.com domain, avoid blind 404 network spam on arbitrary sites
  if (!staticResult.isShopify && !isMyshopifyDomain) {
    return {
      isShopify: false,
      confidence: 'none',
      matchedSignals: [],
    };
  }

  const matchedSignals = [...staticResult.signals];
  if (isMyshopifyDomain) {
    matchedSignals.push('myshopify.com hostname');
  }

  // Probe same-origin /products.json with 3s timeout
  const probeResult = await probeShopifyEndpoint();

  if (probeResult.isShopify) {
    matchedSignals.push('/products.json API endpoint verified');
    return {
      isShopify: true,
      confidence: 'high',
      matchedSignals,
      sampleProduct: probeResult.sampleProduct,
    };
  }

  // Only confirm Shopify if at least one definitive strong signal or myshopify domain is present
  // Prevents false positive injections on WooCommerce or generic stores that have a /checkout form
  if (staticResult.hasStrongSignal || isMyshopifyDomain) {
    return {
      isShopify: true,
      confidence: matchedSignals.length >= 2 ? 'high' : 'medium',
      matchedSignals,
    };
  }

  return {
    isShopify: false,
    confidence: 'none',
    matchedSignals: [],
  };
}

