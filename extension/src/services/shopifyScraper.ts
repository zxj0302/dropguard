/**
 * Shopify Store Data Scraper
 * Extracts store catalog, theme footprint, and active product data in the browser.
 */

export interface ShopifyProductItem {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  published_at: string;
  price: string;
  rawPrice?: number;
  compare_at_price?: string;
  imageUrl?: string;
  url: string;
}

export interface StoreCatalogSummary {
  themeName: string;
  currency: string;
  estimatedCatalogSize: number;
  newestProducts: ShopifyProductItem[];
  vendors: string[];
}

export interface ActivePageProduct {
  isProductPage: boolean;
  title: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
}

/**
 * Detects Shopify theme name from DOM signals.
 */
export function detectStoreTheme(): string {
  // 1. Check meta tags or script comments (support quoted/unquoted keys and single/double quoted values)
  const scripts = Array.from(document.querySelectorAll('script:not([src])'));
  for (const s of scripts) {
    const text = s.textContent || '';
    const match = text.match(/theme\s*=\s*\{[^}]*["']?name["']?\s*:\s*["']([^"']+)["']/i) ||
                  text.match(/themeName["']?\s*:\s*["']([^"']+)["']/i) ||
                  text.match(/Shopify\.theme\s*=\s*\{[^}]*["']?name["']?\s*:\s*["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 2. Check CSS link stylesheets (e.g. Dawn, Impulse, Prestige, Brooklyn)
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="cdn.shopify.com"]'));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes('dawn')) return 'Dawn (Official)';
    if (href.includes('impulse')) return 'Impulse (Archetype)';
    if (href.includes('prestige')) return 'Prestige (Maestrooo)';
    if (href.includes('motion')) return 'Motion (Archetype)';
    if (href.includes('sense')) return 'Sense (Official)';
    if (href.includes('craft')) return 'Craft (Official)';
    if (href.includes('refresh')) return 'Refresh (Official)';
    if (href.includes('studio')) return 'Studio (Official)';
  }

  // 3. Fallback based on HTML classes
  const htmlClass = (document.documentElement.className + ' ' + document.body.className).toLowerCase();
  if (htmlClass.includes('dawn')) return 'Dawn Theme';
  if (htmlClass.includes('prestige')) return 'Prestige Theme';

  return 'Shopify Custom Theme';
}

/**
 * Safely formats currency amounts according to ISO-4217 currency code.
 */
export function formatCurrencyPrice(amount: number, currencyCode = 'USD'): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return '$0.00';
  }
  const cleanCode = (currencyCode || 'USD').toUpperCase().trim();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cleanCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const symbolMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CAD: 'CA$',
      AUD: 'AU$',
      CNY: '¥',
      HKD: 'HK$',
      NZD: 'NZ$',
      SGD: 'SG$',
      CHF: 'CHF ',
      SEK: 'kr ',
      NOK: 'kr ',
      DKK: 'kr ',
      INR: '₹',
      KRW: '₩',
    };
    const sym = symbolMap[cleanCode] || `${cleanCode} `;
    return `${sym}${amount.toFixed(2)}`;
  }
}

/**
 * Robust price parser supporting standard formats ($49.99, $1,299.00), European comma decimals (49,99 €, € 1.299,00),
 * and zero-dollar free products ($0.00) for Free + Shipping marketing scenarios.
 * Matches in strict priority order:
 * 1. European formats with adjacent currency symbols/codes (€ 1.299,00, 1.299,00 €, € 49,99, 49,99 €)
 * 2. Standard formats with adjacent currency symbols/codes ($1,299.00, $49.99, 49.99 USD)
 * 3. Currency symbol/code with integer amounts ($49, € 1299, 49 USD)
 * 4. Explicit decimal amounts without currency symbols (1.299,00, 49,99, 1,299.00, 49.99)
 * 5. Standalone integers (49, 1299) as a last resort, excluding percentages and quantity labels
 */
export function parsePriceString(raw: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, ' ').trim();

  // 1. Priority 1: Adjacent currency symbols or currency codes
  // 1a. European format with thousand dots + comma decimal (e.g. "€ 1.299,00", "1.299,00 €", "1.299,00 EUR")
  const euroThousandWithSymbolMatch = cleaned.match(/(?:[\$€£¥₹₩]\s*)(\d{1,3}(?:\.\d{3})+,\d{2})(?!\d)|(\d{1,3}(?:\.\d{3})+,\d{2})(?!\d)\s*(?:[\$€£¥₹₩]|USD|EUR|GBP|CAD|AUD|JPY|CNY)\b/i);
  if (euroThousandWithSymbolMatch) {
    const numStr = euroThousandWithSymbolMatch[1] || euroThousandWithSymbolMatch[2];
    const val = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 1b. European format with comma decimal (e.g. "€ 49,99", "49,99 €", "49,99 EUR")
  const euroCommaWithSymbolMatch = cleaned.match(/(?:[\$€£¥₹₩]\s*)(\d+,\d{2})(?!\d)|(\d+,\d{2})(?!\d)\s*(?:[\$€£¥₹₩]|USD|EUR|GBP|CAD|AUD|JPY|CNY)\b/i);
  if (euroCommaWithSymbolMatch) {
    const numStr = euroCommaWithSymbolMatch[1] || euroCommaWithSymbolMatch[2];
    const val = parseFloat(numStr.replace(',', '.'));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 1c. Standard format with dot decimal (e.g. "$1,299.00", "$49.99", "49.99 USD", "1,299.00 EUR")
  const dotWithSymbolMatch = cleaned.match(/(?:[\$€£¥₹₩]\s*)(\d+(?:,\d{3})*\.\d{1,2})(?!\d)|(\d+(?:,\d{3})*\.\d{1,2})(?!\d)\s*(?:[\$€£¥₹₩]|USD|EUR|GBP|CAD|AUD|JPY|CNY)\b/i);
  if (dotWithSymbolMatch) {
    const numStr = dotWithSymbolMatch[1] || dotWithSymbolMatch[2];
    const val = parseFloat(numStr.replace(/,/g, ''));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 1d. Integer with currency symbol or code (e.g. "$49", "€ 1299", "49 USD", "¥2000")
  const intWithSymbolMatch = cleaned.match(/(?:[\$€£¥₹₩]\s*)(\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+)(?!\d)|(\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+)(?!\d)\s*(?:[\$€£¥₹₩]|USD|EUR|GBP|CAD|AUD|JPY|CNY)\b/i);
  if (intWithSymbolMatch) {
    const numStr = intWithSymbolMatch[1] || intWithSymbolMatch[2];
    const val = parseFloat(numStr.replace(/,/g, '').replace(/\./g, ''));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 2. Priority 2: Explicit decimal amounts (without currency symbol)
  // 2a. European thousand dot + comma decimal (e.g. "1.299,00")
  const euroThousandsMatch = cleaned.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2})(?!\d)/);
  if (euroThousandsMatch && euroThousandsMatch[1]) {
    const val = parseFloat(euroThousandsMatch[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 2b. Standard European comma decimal (e.g. "49,99")
  const commaDecimalMatch = cleaned.match(/\b(\d+,\d{2})(?!\d)/);
  if (commaDecimalMatch && commaDecimalMatch[1]) {
    const val = parseFloat(commaDecimalMatch[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 2c. Explicit dot decimal (e.g. "1,299.99", "49.99", "0.00")
  const dotDecimalMatch = cleaned.match(/\b(\d+(?:,\d{3})*\.\d{1,2})(?!\d)/);
  if (dotDecimalMatch && dotDecimalMatch[1]) {
    const val = parseFloat(dotDecimalMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 3. Priority 3: Standalone integers, excluding percentages (e.g. "Save 20%") or quantities (e.g. "Pack of 3")
  const integerMatches = Array.from(cleaned.matchAll(/\b(\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d+)\b/g));
  for (const m of integerMatches) {
    const matchedInt = m[1];
    const matchEndIdx = (m.index ?? 0) + m[0].length;
    const following = cleaned.slice(matchEndIdx).trimStart();
    if (/^[%x]|^(?:percent|pack|off|pcs|pieces)\b/i.test(following)) {
      continue;
    }
    const val = parseFloat(matchedInt.replace(/,/g, '').replace(/\./g, ''));
    if (!isNaN(val) && val >= 0) return val;
  }

  // 4. Fallback
  const simple = cleaned.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(simple);
  return !isNaN(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Safely extracts the first valid, non-placeholder image URL from polymorphic Schema.org image fields.
 * Supports:
 * - String URL: "https://example.com/img.jpg"
 * - Array of Strings: ["https://example.com/img1.jpg", ...]
 * - ImageObject: { "@type": "ImageObject", "url": "https://example.com/img.jpg" }
 * - ImageObject with contentUrl / thumbnailUrl / sourceUrl / @id
 * - Array of ImageObjects or mixed arrays
 * - Nested structures
 * - Automatically rejects and filters out data: URIs (transparent GIFs/SVGs), blob: URIs, and blank spacers.
 */
export function extractSchemaImageUrl(imageData: unknown): string | undefined {
  if (!imageData) return undefined;

  const queue = Array.isArray(imageData) ? [...imageData] : [imageData];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;

    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }

    let candidateUrl: string | undefined = undefined;

    if (typeof item === 'string') {
      candidateUrl = item.trim();
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, any>;
      // Check standard Schema.org ImageObject fields
      const raw = obj.url || obj.contentUrl || obj.thumbnailUrl || obj.sourceUrl || (typeof obj['@id'] === 'string' && obj['@id'].startsWith('http') ? obj['@id'] : undefined);
      if (typeof raw === 'string') {
        candidateUrl = raw.trim();
      }
    }

    if (!candidateUrl) continue;

    // Filter out data: base64 placeholders and blob: URLs
    if (candidateUrl.startsWith('data:') || candidateUrl.startsWith('blob:')) {
      continue;
    }

    // Filter out obvious 1x1 blank spacers
    if (candidateUrl.endsWith('spacer.gif') || candidateUrl.endsWith('blank.gif')) {
      continue;
    }

    // Normalize URL
    try {
      return new URL(candidateUrl, window.location.href).href;
    } catch {
      if (candidateUrl.startsWith('//')) {
        return 'https:' + candidateUrl;
      }
      if (candidateUrl.startsWith('http://') || candidateUrl.startsWith('https://')) {
        return candidateUrl;
      }
    }
  }

  return undefined;
}

/**
 * Scrapes currently active product if browsing a product detail page.
 */
export function scrapeActiveProduct(): ActivePageProduct {
  const isProductPage = window.location.pathname.includes('/products/');

  let title = '';
  let price: number | undefined = undefined;
  let imageUrl: string | undefined = undefined;
  let currency = 'USD';

  if (isProductPage) {
    // 0. High-fidelity JSON-LD extraction (Schema.org Product & ProductGroup)
    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of jsonLdScripts) {
      try {
        const json = JSON.parse(s.textContent || '');
        const isProductOrGroup = (item: any) => {
          if (!item || !item['@type']) return false;
          const t = item['@type'];
          return (
            t === 'Product' ||
            t === 'ProductGroup' ||
            (Array.isArray(t) && (t.includes('Product') || t.includes('ProductGroup')))
          );
        };

        const productObj = Array.isArray(json)
          ? json.find(isProductOrGroup)
          : isProductOrGroup(json)
            ? json
            : (json && json['@graph'] && Array.isArray(json['@graph']) && json['@graph'].find(isProductOrGroup));

        if (productObj) {
          if (productObj.name && typeof productObj.name === 'string') {
            title = productObj.name.replace(/\s+/g, ' ').trim();
          }
          if (productObj.image || productObj.images) {
            const extracted = extractSchemaImageUrl(productObj.image || productObj.images);
            if (extracted) {
              imageUrl = extracted;
            }
          }
          let offers = productObj.offers;
          if (!offers && Array.isArray(productObj.hasVariant)) {
            for (const v of productObj.hasVariant) {
              if (v?.offers) {
                offers = v.offers;
                break;
              }
            }
          }
          if (!imageUrl && Array.isArray(productObj.hasVariant)) {
            for (const v of productObj.hasVariant) {
              if (v?.image || v?.images) {
                const extracted = extractSchemaImageUrl(v.image || v.images);
                if (extracted) {
                  imageUrl = extracted;
                  break;
                }
              }
            }
          }
          if (!imageUrl && offers) {
            const offersList = Array.isArray(offers) ? offers : [offers];
            for (const offer of offersList) {
              if (offer && (offer.image || offer.images)) {
                const extracted = extractSchemaImageUrl(offer.image || offer.images);
                if (extracted) {
                  imageUrl = extracted;
                  break;
                }
              }
            }
          }
          if (offers) {
            const targetOffer = Array.isArray(offers) ? offers[0] : offers;
            if (targetOffer) {
              const rawPrice = targetOffer.price ?? targetOffer.lowPrice ?? targetOffer.highPrice;
              if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
                const parsed = parsePriceString(String(rawPrice));
                if (parsed !== undefined) price = parsed;
              }
              if (targetOffer.priceCurrency) currency = targetOffer.priceCurrency;
            }
          }
          if (title) break;
        }
      } catch {
        // ignore parsing error
      }
    }

    // 1. Clean Title fallback: prioritize specific product title selectors before generic h1
    if (!title) {
      let domTitle: string | undefined = undefined;
      const titleSelectors = [
        '.product__title',
        '.product-title',
        '[data-product-title]',
        '.product-single__title',
        'main h1',
        'article h1',
        'h1',
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        const text = el?.textContent?.replace(/\s+/g, ' ').trim();
        if (text) {
          domTitle = text;
          break;
        }
      }
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.replace(/\s+/g, ' ').trim();
      const cleanOgTitle = ogTitle ? ogTitle.split(/ [–—|-] /)[0].trim() : '';
      title = domTitle || cleanOgTitle || ogTitle || document.title.split(/ [–—|-] /)[0].trim();
    }

    // 2. Image (normalize to valid absolute URLs, check og:image and DOM gallery)
    if (!imageUrl) {
      const ogImage = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:secure_url"]')?.getAttribute('content');
      
      const imgElem = document.querySelector('.product__media img, .product-featured-media img, .product__featured-image, [data-product-single-thumbnail], .product-gallery img');
      let domImage: string | null = null;
      if (imgElem) {
        // Prefer real src attributes over data: placeholder src
        const dataMaster = imgElem.getAttribute('data-master');
        const dataHighres = imgElem.getAttribute('data-highres');
        const dataSrc = imgElem.getAttribute('data-src');
        const src = imgElem.getAttribute('src');
        const srcset = imgElem.getAttribute('data-srcset') || imgElem.getAttribute('srcset');

        const candidates = [dataMaster, dataHighres, dataSrc, src];
        for (const cand of candidates) {
          if (cand && !cand.startsWith('data:') && !cand.startsWith('blob:')) {
            domImage = cand;
            break;
          }
        }

        // If still nothing and srcset exists, extract first valid URL from srcset
        if (!domImage && srcset) {
          const firstSrcsetPart = srcset.split(',')[0]?.trim().split(/\s+/)[0];
          if (firstSrcsetPart && !firstSrcsetPart.startsWith('data:')) {
            domImage = firstSrcsetPart;
          }
        }
      }

      const rawImg = (ogImage && !ogImage.startsWith('data:')) ? ogImage : domImage;
      if (rawImg && !rawImg.startsWith('data:') && !rawImg.startsWith('blob:')) {
        try {
          imageUrl = new URL(rawImg, window.location.href).href;
        } catch {
          imageUrl = rawImg.startsWith('//') ? 'https:' + rawImg : rawImg;
        }
      }
    }

    // 3. Currency detection (Shopify standard product:price:currency or og:price:currency)
    const currencyMeta = document.querySelector('meta[property="product:price:currency"], meta[property="og:price:currency"]')?.getAttribute('content');
    if (currencyMeta) currency = currencyMeta;

    // 4. Price: check Shopify standard meta tags, then DOM price selectors
    if (price === undefined) {
      const priceMeta = document.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"]')?.getAttribute('content');
      if (priceMeta) {
        const parsed = parsePriceString(priceMeta);
        if (parsed !== undefined) price = parsed;
      }
    }

    // Fallback: check DOM price elements
    if (price === undefined) {
      const priceElem = document.querySelector('.price-item--regular, .price__regular, .product-price, [data-product-price]');
      if (priceElem && priceElem.textContent) {
        const parsed = parsePriceString(priceElem.textContent);
        if (parsed !== undefined) {
          price = parsed;
        }
      }
    }
  }

  return {
    isProductPage,
    title,
    price,
    currency,
    imageUrl,
  };
}

/**
 * Safely fetches with an AbortController timeout (default 7 seconds).
 * Prevents requests from hanging indefinitely on stalled stores and blocking the Store Insights panel.
 */
async function fetchWithTimeout(url: string, timeoutMs = 7000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrapes public product catalog from /products.json?limit=30
 */
export async function scrapePublicCatalog(): Promise<StoreCatalogSummary> {
  const themeName = detectStoreTheme();
  let currency = 'USD';

  // 0. Pre-detect store currency from DOM meta tags (isolated content script world cannot access main-world window.Shopify)
  const curMeta = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"]')?.getAttribute('content');
  if (curMeta && curMeta.trim()) {
    currency = curMeta.trim().toUpperCase();
  }

  let products: ShopifyProductItem[] = [];
  const vendorsSet = new Set<string>();

  try {
    // 1. Fetch primary products.json with 7s timeout
    let res = await fetchWithTimeout(`${window.location.origin}/products.json?limit=30`, 7000);

    // 2. Fallback to collections/all/products.json if root products.json is protected, 404 or timed out
    if (!res || !res.ok) {
      res = await fetchWithTimeout(`${window.location.origin}/collections/all/products.json?limit=30`, 7000);
    }

    // Check whether the response is valid JSON to prevent syntax errors on Cloudflare challenge HTML pages
    if (res && res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data && Array.isArray(data.products)) {
        // Try getting store currency if not already detected
        if (currency === 'USD') {
          const freshMeta = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"]')?.getAttribute('content');
          if (freshMeta && freshMeta.trim()) {
            currency = freshMeta.trim().toUpperCase();
          }
        }

        products = data.products.map((p: any) => {
          if (p.vendor) vendorsSet.add(p.vendor);

          const firstVariant = p.variants && p.variants[0];
          const firstImage = p.images && p.images[0];

          let normalizedImgSrc = firstImage?.src;
          if (normalizedImgSrc && (normalizedImgSrc.startsWith('data:') || normalizedImgSrc.startsWith('blob:'))) {
            normalizedImgSrc = undefined;
          }
          if (normalizedImgSrc) {
            try {
              normalizedImgSrc = new URL(normalizedImgSrc, window.location.href).href;
            } catch {
              if (normalizedImgSrc.startsWith('//')) {
                normalizedImgSrc = 'https:' + normalizedImgSrc;
              }
            }
          }

          // Rigorous check for zero-dollar products (e.g. 0, "0", "0.00") without treating 0 as falsy
          const hasVariantPrice = firstVariant?.price != null && firstVariant?.price !== '';
          const parsedPrice = hasVariantPrice ? parseFloat(String(firstVariant.price)) : NaN;
          const priceDisplay = !isNaN(parsedPrice) ? formatCurrencyPrice(parsedPrice, currency) : formatCurrencyPrice(0, currency);

          const hasComparePrice = firstVariant?.compare_at_price != null && firstVariant?.compare_at_price !== '';
          const parsedCompare = hasComparePrice ? parseFloat(String(firstVariant.compare_at_price)) : NaN;
          const compareDisplay = !isNaN(parsedCompare) ? formatCurrencyPrice(parsedCompare, currency) : undefined;

          return {
            id: p.id,
            title: p.title,
            handle: p.handle,
            vendor: p.vendor || 'Unknown',
            product_type: p.product_type || 'General',
            published_at: p.published_at,
            price: priceDisplay,
            rawPrice: !isNaN(parsedPrice) ? parsedPrice : undefined,
            compare_at_price: compareDisplay,
            imageUrl: normalizedImgSrc,
            url: `${window.location.origin}/products/${p.handle}`,
          };
        });
      }
    }
  } catch (err) {
    console.warn('[DropGuard] Error scraping catalog products.json', err);
  }

  return {
    themeName,
    currency,
    estimatedCatalogSize: products.length,
    newestProducts: products,
    vendors: Array.from(vendorsSet),
  };
}
