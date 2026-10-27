import { TRADEMARK_BLACKLIST, TrademarkEntry } from '../data/trademarkBlacklist.js';

export interface DetectedTermMatch {
  term: string;
  matched_text: string;
  similarity: number;
  match_type: 'EXACT' | 'FUZZY_VARIATION' | 'PHONETIC_OR_ALIAS';
  owner: string;
  category: string;
  lawsuit_risk: 'EXTREME' | 'HIGH' | 'MEDIUM';
  description: string;
}

export interface IpCheckResponse {
  risk_level: 'SAFE' | 'WARNING' | 'DANGER';
  risk_score: number;
  detected_terms: DetectedTermMatch[];
  summary: string;
  product_title_analyzed: string;
  checked_at: string;
}

/**
 * Standard dynamic programming implementation of Levenshtein Distance.
 * Time: O(M * N), Space: O(min(M, N)).
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  let prevRow = new Array<number>(s2.length + 1);
  let currRow = new Array<number>(s2.length + 1);

  for (let j = 0; j <= s2.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    currRow[0] = i;
    const c1 = s1.charCodeAt(i - 1);

    for (let j = 1; j <= s2.length; j++) {
      const c2 = s2.charCodeAt(j - 1);
      const cost = c1 === c2 ? 0 : 1;

      currRow[j] = Math.min(
        currRow[j - 1] + 1,       // insertion
        prevRow[j] + 1,           // deletion
        prevRow[j - 1] + cost     // substitution
      );
    }

    // Swap row references for memory efficiency
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[s2.length];
}

// Common generic e-commerce words, natural nouns, and materials that should not trigger fuzzy false positives against brand names
const GENERIC_COMMERCE_WORDS = new Set([
  'phone', 'watch', 'pad', 'book', 'glass', 'strap', 'grip', 'case', 'tote',
  'clog', 'clogs', 'sandal', 'sandals', 'shirt', 'pant', 'ring', 'bag', 'cup', 'air', 'pod', 'caps',
  'cross', 'crosses', 'channel', 'channels', 'panel', 'panels', 'cord', 'cords',
  'chain', 'chains', 'pendant', 'pendants', 'connector', 'diffuser', 'hardware', 'necklace',
  'marble', 'cotton', 'leather', 'wooden', 'metal', 'silver', 'golden', 'velvet', 'linen',
  'apply', 'shares', 'super', 'simple', 'sample', 'supply', 'natural', 'organic', 'gentle',
  'beat', 'beats',
  'ample', 'thorn', 'thorns', 'storage', 'closet', 'gardening', 'gloves', 'glove',
  'rose', 'roses', 'proof', 'organizer', 'organizers', 'pruning',
  // Common daily natural nouns & fruits and their plurals (prevents false positives against brands like Apple Inc.)
  'apple', 'apples', 'berry', 'berries', 'fruit', 'fruits',
  'cherry', 'cherries', 'orange', 'oranges', 'lemon', 'lemons',
  'peach', 'peaches', 'banana', 'bananas', 'mango', 'mangoes',
  'grape', 'grapes', 'melon', 'melons', 'pear', 'pears', 'plum', 'plums',
  'strawberry', 'strawberries', 'blueberry', 'blueberries', 'pineapple', 'pineapples',
  'cider', 'juice', 'snack', 'snacks', 'salad', 'salads', 'peeler', 'slicer', 'corer', 'orchard'
]);

// Memory cache for compiled boundary regexes to prevent per-request re-compilation
const regexCache = new Map<string, RegExp>();

/**
 * Normalized string similarity ratio between 0.0 and 1.0.
 */
export function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = calculateLevenshteinDistance(a, b);
  return Number((1 - dist / maxLen).toFixed(3));
}

/**
 * Strips diacritics / accents from text (e.g., 'Pokémon' -> 'Pokemon').
 */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Builds a boundary-safe regular expression that flexibly matches brand terms
 * across hyphens, spaces, or concatenated variants (e.g. 'Ray-Ban', 'Ray Ban', 'Rayban'; 'Star Wars', 'Star-Wars').
 * Accurately treats CJK (Chinese, Japanese, Korean) ideographs as distinct scripts to support multilingual mixed titles.
 */
function buildFlexibleBoundaryRegex(target: string): RegExp {
  const cached = regexCache.get(target);
  if (cached) return cached;

  const isCjkTarget = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(target);
  const parts = target.trim().split(/[-\s]+/);
  const escapedParts = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Match with optional hyphens or whitespace separator between parts
  const pattern = escapedParts.join('[-\\s]*');

  let regex: RegExp;
  if (isCjkTarget) {
    // For CJK targets, any occurrence in mixed or native text matches
    regex = new RegExp(pattern, 'iu');
  } else {
    // For Latin / non-CJK targets, boundary must not be adjacent Latin letter or number
    // CJK characters, punctuation, whitespace, and string edges are valid boundaries
    regex = new RegExp(`(^|[^\\p{Script=Latin}\\p{N}])${pattern}([^\\p{Script=Latin}\\p{N}]|$)`, 'iu');
  }

  regexCache.set(target, regex);
  return regex;
}

/**
 * Tokenize a title string into words, 2-grams and 3-grams.
 * Preserves multilingual characters (Unicode letters) and normalizes accents and hyphenated variants.
 */
export function generateNGrams(text: string): string[] {
  const capped = (text || '').slice(0, 500);

  // Insert whitespace between Latin/Number and CJK ideographs to ensure accurate tokenization for mixed titles
  const separated = capped
    .replace(/([\p{Script=Latin}\p{N}])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu, '$1 $2')
    .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])([\p{Script=Latin}\p{N}])/gu, '$1 $2');

  // Clean punctuation and normalize whitespace while preserving multilingual letters (\p{L})
  const sanitized = separated
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Create word lists: both hyphen-split and original tokens
  const words = sanitized.split(' ').filter(Boolean);
  const unhyphenatedWords = sanitized.replace(/-/g, ' ').split(' ').filter(Boolean);
  const ngrams = new Set<string>();

  // 1-grams (individual tokens) - add both original and accent-stripped tokens
  for (const word of [...words, ...unhyphenatedWords]) {
    if (word.length > 1) {
      ngrams.add(word);
      const unaccented = stripAccents(word);
      if (unaccented !== word) {
        ngrams.add(unaccented);
      }
    }
  }

  // 2-grams (two-word phrases) from unhyphenated stream
  for (let i = 0; i < unhyphenatedWords.length - 1; i++) {
    ngrams.add(`${unhyphenatedWords[i]} ${unhyphenatedWords[i + 1]}`);
    const unaccented = `${stripAccents(unhyphenatedWords[i])} ${stripAccents(unhyphenatedWords[i + 1])}`;
    ngrams.add(unaccented);
  }

  // 3-grams (three-word phrases) from unhyphenated stream
  for (let i = 0; i < unhyphenatedWords.length - 2; i++) {
    ngrams.add(`${unhyphenatedWords[i]} ${unhyphenatedWords[i + 1]} ${unhyphenatedWords[i + 2]}`);
    const unaccented = `${stripAccents(unhyphenatedWords[i])} ${stripAccents(unhyphenatedWords[i + 1])} ${stripAccents(unhyphenatedWords[i + 2])}`;
    ngrams.add(unaccented);
  }

  // Extract CJK 2-4 character segments for Chinese/Japanese brand alias matching without spaces
  const cjkMatches = sanitized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu);
  if (cjkMatches) {
    for (const cjkBlock of cjkMatches) {
      if (cjkBlock.length >= 2 && cjkBlock.length <= 10) {
        ngrams.add(cjkBlock);
      }
      for (let len = 2; len <= Math.min(4, cjkBlock.length); len++) {
        for (let i = 0; i <= cjkBlock.length - len; i++) {
          ngrams.add(cjkBlock.substring(i, i + len));
        }
      }
    }
  }

  return Array.from(ngrams);
}

/**
 * Core IP Radar evaluation engine.
 */
export function analyzeProductTitleForIP(productTitle: string): IpCheckResponse {
  if (!productTitle || typeof productTitle !== 'string' || !productTitle.trim()) {
    return {
      risk_level: 'SAFE',
      risk_score: 0,
      detected_terms: [],
      summary: 'No product title provided for analysis.',
      product_title_analyzed: '',
      checked_at: new Date().toISOString(),
    };
  }

  // Truncate to 500 chars to prevent CPU exhaustion on malformed inputs
  const safeTitle = productTitle.slice(0, 500);
  const normalizedTitle = safeTitle.toLowerCase().replace(/\s+/g, ' ').trim();
  const unaccentedTitle = stripAccents(normalizedTitle);
  const ngrams = generateNGrams(safeTitle);
  const matchesMap = new Map<string, DetectedTermMatch>();

  for (const entry of TRADEMARK_BLACKLIST) {
    const targets = [entry.term, ...entry.aliases];

    for (const target of targets) {
      const normalizedTarget = target.toLowerCase().trim();
      const unaccentedTarget = stripAccents(normalizedTarget);

      // Special disambiguation for Apple Inc. (Tech / Gadget):
      // Require tech accessories / digital context indicators for Apple matching, or exclude when title
      // describes natural fruit, grocery, produce, home storage, gardening, apparel or non-tech everyday goods.
      const isAppleTechContext =
        /\b(iphone|ipad|macbook|watch|airpods|airpod|magsafe|charger|charging|cable|case|cover|pro|max|phone|lightning|adapter|screen[\s-]protector|stylus|pencil|keyboard|battery|usb|type[\s-]c|earphone|earphones|earbud|earbuds|gadget|electronic|smart|device|ios)\b/i.test(normalizedTitle);

      const isAppleFruitOrNonTechContext =
        /\b(fruit|fruits|produce|juice|cider|orchard|pie|salad|peeler|slicer|corer|kitchen|knife|grocery|snack|snacks|food|fresh|sweet|organic|tree|storage|closet|organizer|shelf|shelves|drawer|wardrobe|clothes|clothing|gardening|garden|rose|glove|gloves|plant|pruning|thorn|thorns|outdoor|furniture|home|decor|apparel|fabric)\b/i.test(normalizedTitle);

      if (entry.term === 'Apple' && normalizedTarget === 'apple') {
        // Standalone 'apple' brand check: exclude if in fruit/grocery/home/storage context, or if no tech context is present
        if (!isAppleTechContext || isAppleFruitOrNonTechContext) {
          continue;
        }
      }

      // Special disambiguation for Beats (Tech / Gadget):
      // If target is standalone 'beats', require audio/earphone context words
      // (headphone, earbud, audio, wireless, earphone, sound, etc.) to prevent false positives
      // on everyday phrases like "Heart Beats Monitor", "Drum Beats", "Beats The Rest".
      const isBeatsAudioContext =
        /\b(headphone|headphones|earbud|earbuds|audio|wireless|earphone|earphones|sound|bluetooth|speaker|speakers|noise[\s-]cancelling|headset)\b/i.test(normalizedTitle);

      if (entry.term === 'Beats' && normalizedTarget === 'beats' && !isBeatsAudioContext) {
        continue;
      }

      // Special disambiguation for Stanley drinkware:
      // If target is standalone 'stanley', require drinkware/cup/bottle context words
      // (cup, tumbler, bottle, mug, quencher, thermos, drinkware, iceflow, straw, insulated, vacuum, 40oz, etc.)
      // to avoid false positives on Stanley Black & Decker hardware tools (Stanley screwdriver, tape measure, utility knife, etc.)
      const isStanleyDrinkwareContext =
        /\b(cup|cups|tumbler|tumblers|bottle|bottles|mug|mugs|quencher|quenchers|thermos|drinkware|iceflow|straw|straws|flask|flasks|insulated|vacuum|hydration|water[\s-]bottle|40oz|30oz|20oz)\b/i.test(normalizedTitle);

      if (entry.term === 'Stanley Cup' && normalizedTarget === 'stanley' && !isStanleyDrinkwareContext) {
        continue;
      }

      // Footwear context check for Crocs disambiguation
      const isCrocsFootwearContext =
        /\b(shoe|shoes|sandal|sandals|clog|clogs|footwear|slipper|slippers|slide|slides|eva|foam|hole|holes|jibbitz|strap|charms?)\b/i.test(normalizedTitle);

      // Luxury / fashion / beauty context check for Chanel disambiguation
      const isChanelFashionContext =
        /\b(bag|bags|perfume|fragrance|luxury|fashion|quilted|handbag|purse|tote|wallet|dress|cosmetic|cosmetics|beauty|jewelry|earring|earrings|brooch)\b/i.test(normalizedTitle);

      // 1. Flexible boundary regex match (handles spaces, hyphens, and joined names like 'Ray-Ban', 'Ray Ban', 'Rayban')
      const boundaryRegex = buildFlexibleBoundaryRegex(normalizedTarget);
      const unaccentedRegex = buildFlexibleBoundaryRegex(unaccentedTarget);

      if (boundaryRegex.test(normalizedTitle) || unaccentedRegex.test(unaccentedTitle)) {
        matchesMap.set(entry.term, {
          term: entry.term,
          matched_text: target,
          similarity: 1.0,
          match_type: target === entry.term ? 'EXACT' : 'PHONETIC_OR_ALIAS',
          owner: entry.owner,
          category: entry.category,
          lawsuit_risk: entry.lawsuitRisk,
          description: entry.description,
        });
        break; // Matched this blacklist entry, continue to next
      }

      // 2. Fuzzy Levenshtein match across n-grams (catches intentional typos, e.g., 'Disnny', 'Pokemom')
      // Only fuzzy match brands with length >= 4 to avoid high false-positive rates on short acronyms
      if (normalizedTarget.length >= 4) {
        for (const token of ngrams) {
          // Skip common generic words from fuzzy matching brand names
          if (GENERIC_COMMERCE_WORDS.has(token.toLowerCase())) {
            continue;
          }

          // Avoid fuzzy matching against Apple Inc. if title lacks tech context or is in non-tech/fruit context
          if (entry.term === 'Apple' && (!isAppleTechContext || isAppleFruitOrNonTechContext)) {
            continue;
          }

          // Avoid fuzzy matching against Beats if title is not audio context
          if (entry.term === 'Beats' && !isBeatsAudioContext) {
            continue;
          }

          // Avoid fuzzy matching against Crocs if title is not footwear context (prevents 'cross' -> 'crocs' false positive)
          if (entry.term === 'Crocs' && !isCrocsFootwearContext) {
            continue;
          }

          // Avoid fuzzy matching against Chanel if title is not luxury/fashion/beauty context (prevents 'channel' -> 'chanel' false positive)
          if (entry.term === 'Chanel' && !isChanelFashionContext) {
            continue;
          }

          // Avoid fuzzy matching against Stanley Cup if title is not drinkware context
          if (entry.term === 'Stanley Cup' && !isStanleyDrinkwareContext) {
            continue;
          }

          // Only compare tokens with close character lengths
          if (Math.abs(token.length - normalizedTarget.length) <= 2) {
            const dist = calculateLevenshteinDistance(token, normalizedTarget);
            const sim = calculateSimilarity(token, normalizedTarget);

            // Precision fuzzy filter:
            // - Words with length >= 5: accept 1 edit distance or >= 0.80 similarity (e.g. 'guci' for 'gucci', 'aplle' for 'apple', 'disny' for 'disney')
            // - Words with length 4: strictly restrict to plural/suffix 's' variation (token === normalizedTarget + 's', e.g. 'nikes' for 'nike', 'legos' for 'lego', 'thors' for 'thor'),
            //   preventing arbitrary 5-letter words with edit distance 1 (such as 'thorn' matching 'thor') from false positive triggers.
            const isFuzzyHit =
              (normalizedTarget.length >= 5 && (dist === 1 || sim >= 0.80)) ||
              (normalizedTarget.length === 4 && token === normalizedTarget + 's');

            if (isFuzzyHit && sim < 1.0) {
              const existing = matchesMap.get(entry.term);
              if (!existing || existing.similarity < sim) {
                matchesMap.set(entry.term, {
                  term: entry.term,
                  matched_text: `${token} (fuzzy match for ${target})`,
                  similarity: sim,
                  match_type: 'FUZZY_VARIATION',
                  owner: entry.owner,
                  category: entry.category,
                  lawsuit_risk: entry.lawsuitRisk,
                  description: entry.description,
                });
              }
            }
          }
        }
      }
    }
  }

  const detectedTerms = Array.from(matchesMap.values()).sort(
    (a, b) => b.similarity - a.similarity
  );

  // Compute Risk Score and Level
  let riskScore = 0;
  let riskLevel: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';

  if (detectedTerms.length > 0) {
    const hasExact = detectedTerms.some((t) => t.similarity === 1.0);
    const hasExtreme = detectedTerms.some((t) => t.lawsuit_risk === 'EXTREME');

    if (hasExact && hasExtreme) {
      riskScore = Math.min(100, 90 + detectedTerms.length * 3);
      riskLevel = 'DANGER';
    } else if (hasExact) {
      riskScore = Math.min(88, 80 + detectedTerms.length * 2);
      riskLevel = 'DANGER';
    } else {
      // Fuzzy matches
      const maxSim = Math.max(...detectedTerms.map((t) => t.similarity));
      if (hasExtreme && maxSim >= 0.80) {
        // High-similarity intentional typo targeting an EXTREME lawsuit risk brand (e.g. Disnny, Pokemom, Guci)
        riskScore = Math.min(95, Math.round(maxSim * 92));
        riskLevel = 'DANGER';
      } else {
        riskScore = Math.round(maxSim * 75);
        riskLevel = riskScore >= 70 ? 'DANGER' : 'WARNING';
      }
    }
  } else {
    riskScore = 5; // Clean baseline
    riskLevel = 'SAFE';
  }

  let summary = '';
  if (riskLevel === 'DANGER') {
    summary = `Critical IP infringement risk detected! Matched ${detectedTerms.length} registered trademark/patent entity. Listing this item carries immediate risk of PayPal/Stripe account freezing or federal court TRO lawsuit.`;
  } else if (riskLevel === 'WARNING') {
    summary = `Potential trademark similarity detected (${detectedTerms.length} near-match variant). Check whether your supplier has authorized rights before scaling ads.`;
  } else {
    summary = 'No registered trademark or patent blacklist matches found. Listing appears clean under current database.';
  }

  return {
    risk_level: riskLevel,
    risk_score: riskScore,
    detected_terms: detectedTerms,
    summary,
    product_title_analyzed: productTitle,
    checked_at: new Date().toISOString(),
  };
}
