export interface SourceFinderRequest {
  product_title: string;
  retail_price?: number;
  currency?: string;
  product_image?: string;
}

export interface DirectSourcingLinks {
  aliexpress: string;
  alibaba1688: string;
  taobao: string;
  google_lens?: string;
}

export interface ProfitEstimate {
  retail_price: number;
  estimated_factory_cost_min: number;
  estimated_factory_cost_max: number;
  estimated_shipping_cost: number;
  estimated_gross_profit: number;
  estimated_gross_margin_percentage: number;
  currency: string;
}

export interface SourceFinderResponse {
  search_keywords: string;
  profit_estimate: ProfitEstimate;
  direct_sourcing_links: DirectSourcingLinks;
  dropship_insights: {
    recommended_moq: number;
    typical_dispatch_time: string;
    suggested_ad_spend_cap: number;
    sourcing_channel_advice: string;
  };
  analyzed_at: string;
}

/**
 * Clean product title to extract high-yield supply search keywords.
 * Supports Unicode words (Chinese, Japanese, Latin, etc.) and guards input length.
 */
function extractSourcingKeywords(title: string): string {
  const cleanTitle = (title || '').slice(0, 500);

  const stopWords = new Set([
    'free', 'shipping', 'new', 'hot', 'sale', 'best', 'seller', 'top', 'quality',
    'women', 'men', 'unisex', 'fashion', 'cute', 'vintage', 'luxury', '2024', '2025', '2026',
    'pro', 'plus', 'original', 'creative', 'custom', 'personalized', 'deal'
  ]);

  // Use Unicode property escapes \p{L} and \p{N} to preserve Chinese/multilingual terms
  const sanitized = cleanTitle
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = sanitized.split(' ');
  const filtered = words.filter((w) => (w.length > 1 || /[\p{Script=Han}]/u.test(w)) && !stopWords.has(w.toLowerCase()));

  // Keep first 3 to 5 core descriptive terms
  const selected = filtered.slice(0, 5);
  return selected.join(' ') || cleanTitle.slice(0, 30);
}

/**
 * Analyze product sourcing potential and calculate margin brackets safely.
 */
export function analyzeSourcing(input: SourceFinderRequest): SourceFinderResponse {
  const { product_title, retail_price, currency = 'USD', product_image } = input;
  
  // Safely validate and clamp retail_price to finite range [0, 1_000_000]
  let safeRetailPrice = 39.99;
  if (retail_price !== undefined && retail_price !== null) {
    const parsed = typeof retail_price === 'number' ? retail_price : parseFloat(String(retail_price));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000) {
      safeRetailPrice = Number(parsed.toFixed(2));
    }
  }
  const keywords = extractSourcingKeywords(product_title);

  // Ex-factory unit costs typically range between 18% to 28% of D2C Shopify retail price
  // Scale minimum floor dynamically so low-ticket items (e.g. $5 - $15) are not artificially pushed into negative profit
  const minFloor = Math.min(2.0, Number((safeRetailPrice * 0.25).toFixed(2)));
  const maxFloor = Math.min(4.0, Number((safeRetailPrice * 0.35).toFixed(2)));
  const costMin = safeRetailPrice > 0 ? Number(Math.max(minFloor, (safeRetailPrice * 0.18)).toFixed(2)) : 0;
  const costMax = safeRetailPrice > 0 ? Number(Math.max(maxFloor, (safeRetailPrice * 0.28)).toFixed(2)) : 0;
  const avgCost = Number(((costMin + costMax) / 2).toFixed(2));
  // Cross-border shipping line scaled appropriately for micro-packet items
  const estimatedShipping = safeRetailPrice > 0
    ? Number(Math.min(4.80, Math.max(1.80, safeRetailPrice * 0.30)).toFixed(2))
    : 0;

  const grossProfitCalc = Number((safeRetailPrice - avgCost - estimatedShipping).toFixed(2));
  const grossProfit = Number.isFinite(grossProfitCalc) ? grossProfitCalc : 0;
  // Gross margin percentage properly factoring in factory cost and cross-border shipping
  const grossMarginCalc = safeRetailPrice > 0
    ? Number(((grossProfit / safeRetailPrice) * 100).toFixed(1))
    : 0;
  const grossMargin = Number.isFinite(grossMarginCalc) ? grossMarginCalc : 0;

  // Max recommended CPA (cost per purchase in Meta/TikTok ads) to remain profitable
  const adSpendCapCalc = grossProfit > 0 ? Number((grossProfit * 0.65).toFixed(2)) : 0;
  const adSpendCap = Number.isFinite(adSpendCapCalc) ? adSpendCapCalc : 0;

  // Build deep links
  const encodedKeywords = encodeURIComponent(keywords);
  const sourcingLinks: DirectSourcingLinks = {
    aliexpress: `https://www.aliexpress.com/wholesale?SearchText=${encodedKeywords}`,
    alibaba1688: `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodedKeywords}`,
    taobao: `https://s.taobao.com/search?q=${encodedKeywords}`,
  };

  // Support protocol-relative URLs (e.g., //cdn.shopify.com/...)
  let normalizedImageUrl: string | undefined =
    typeof product_image === 'string' ? product_image.trim() : undefined;
  if (normalizedImageUrl && normalizedImageUrl.startsWith('//')) {
    normalizedImageUrl = 'https:' + normalizedImageUrl;
  }
  if (normalizedImageUrl && (normalizedImageUrl.startsWith('http://') || normalizedImageUrl.startsWith('https://'))) {
    sourcingLinks.google_lens = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(normalizedImageUrl)}`;
  }

  const sourcingAdvice =
    grossProfit <= 0
      ? 'Negative or zero profit margin! Current retail price cannot cover factory cost and cross-border shipping. Increase price or bundle.'
      : 'Sourcing directly via 1688 gives 40-60% lower costs than AliExpress. Use agent (CJ/AutoDS/Sup) for 1-click fulfillment.';

  return {
    search_keywords: keywords,
    profit_estimate: {
      retail_price: safeRetailPrice,
      estimated_factory_cost_min: costMin,
      estimated_factory_cost_max: costMax,
      estimated_shipping_cost: estimatedShipping,
      estimated_gross_profit: grossProfit,
      estimated_gross_margin_percentage: grossMargin,
      currency,
    },
    direct_sourcing_links: sourcingLinks,
    dropship_insights: {
      recommended_moq: 1,
      typical_dispatch_time: '24-48 Hours',
      suggested_ad_spend_cap: adSpendCap,
      sourcing_channel_advice: sourcingAdvice,
    },
    analyzed_at: new Date().toISOString(),
  };
}

