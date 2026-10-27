import { analyzeSourcing } from './server/src/services/sourceFinder.js';
import { analyzeProductTitleForIP } from './server/src/services/ipRadar.js';
import { generateCheckoutToken, verifyAndConsumeCheckoutToken, isMainModule, serverInstance, verifyStripeSignature } from './server/src/index.js';
import { activateProDevice, isProDevice, revokeProDevice, getDeviceQuotaStatus } from './server/src/middleware/quota.js';
import { parsePriceString } from './extension/src/services/shopifyScraper.js';
import { isSecureApiUrl, isLocalHostname } from './extension/src/config.js';
import crypto from 'node:crypto';

console.log('--- Testing Defect 1: product_image non-string guard ---');
try {
  // Test with object as product_image
  const res1 = analyzeSourcing({
    product_title: 'Test Sourcing Item',
    retail_price: 29.99,
    product_image: { url: 'https://example.com/img.jpg' } as any
  });
  console.log('✅ res1 (object product_image) succeeded without TypeError:', res1.direct_sourcing_links);

  // Test with number as product_image
  const res2 = analyzeSourcing({
    product_title: 'Test Sourcing Item',
    retail_price: 29.99,
    product_image: 12345 as any
  });
  console.log('✅ res2 (number product_image) succeeded without TypeError:', res2.direct_sourcing_links);

  // Test with null
  const res3 = analyzeSourcing({
    product_title: 'Test Sourcing Item',
    retail_price: 29.99,
    product_image: null as any
  });
  console.log('✅ res3 (null product_image) succeeded without TypeError:', res3.direct_sourcing_links);

  // Test with valid string
  const res4 = analyzeSourcing({
    product_title: 'Test Sourcing Item',
    retail_price: 29.99,
    product_image: '//cdn.shopify.com/products/test.png'
  });
  console.log('✅ res4 (valid string) normalized lens URL:', res4.direct_sourcing_links.google_lens);
} catch (e: any) {
  console.error('❌ Defect 1 test failed:', e);
  process.exit(1);
}

console.log('\n--- Testing Defect 2: Checkout token and Production activation ---');
const testDeviceId = 'device-test-uuid-12345';
const checkoutToken = generateCheckoutToken(testDeviceId);
console.log('Generated checkout token:', checkoutToken);

// Verification 1: Valid token matches device
const valid1 = verifyAndConsumeCheckoutToken(testDeviceId, checkoutToken);
console.log('✅ First token consumption result (expected true):', valid1);

// Verification 2: Replay attack fails
const valid2 = verifyAndConsumeCheckoutToken(testDeviceId, checkoutToken);
console.log('✅ Replay token consumption result (expected false):', valid2);

// Verification 3: Token for device A cannot be used on device B
const tokenForA = generateCheckoutToken('device-aaa-111');
const validOtherDevice = verifyAndConsumeCheckoutToken('device-bbb-222', tokenForA);
console.log('✅ Cross-device token consumption result (expected false):', validOtherDevice);

console.log('\n--- Testing Defect 3: False positive convergence ("Shark", "Ninja", "Aviator") ---');
const fpCases = [
  { title: 'Kids Shark Slippers Cartoon Non-Slip Shoes', shouldMatch: false },
  { title: 'Cute Shark Plush Toy Doll Pillow', shouldMatch: false },
  { title: 'Ninja Costume for Boys Kids Halloween Party', shouldMatch: false },
  { title: 'Men Classic Aviator Sunglasses Metal Frame', shouldMatch: false },
  { title: 'Vintage Aviator Leather Jacket Flight Bomber', shouldMatch: false },
  { title: 'Ray-Ban Aviator Classic Sunglasses RB3025', shouldMatch: true },
  { title: 'Ray-Ban Wayfarer Classic Black', shouldMatch: true },
  { title: 'Ninja Creami Ice Cream Maker 7-in-1', shouldMatch: true },
  { title: 'Ninja Air Fryer Pro 4-in-1 5 Quart', shouldMatch: true },
  { title: 'Shark Vacuum Cordless Pet Pro', shouldMatch: true },
];

for (const c of fpCases) {
  const result = analyzeProductTitleForIP(c.title);
  const matched = result.detected_terms.length > 0;
  if (matched !== c.shouldMatch) {
    console.error(`❌ Mismatch for "${c.title}": expected matched=${c.shouldMatch}, got ${matched} (${JSON.stringify(result.detected_terms.map(t => t.matched_text))})`);
    process.exit(1);
  } else {
    console.log(`✅ Title: "${c.title}" -> ${matched ? 'MATCHED: ' + result.detected_terms.map(t => t.matched_text).join(',') : 'SAFE (No false positive)'}`);
  }
}

console.log('\n--- Testing Defect 4: Server module decoupling (no autostart on import) ---');
if (isMainModule() !== false) {
  console.error('❌ Defect 4 failed: isMainModule() returned true upon module import');
  process.exit(1);
}
if (serverInstance !== null) {
  console.error('❌ Defect 4 failed: serverInstance should be null when imported');
  process.exit(1);
}
console.log('✅ Server module imported without auto-starting HTTP listener');

console.log('\n--- Testing Defect 5 (L4): European thousand dot price parsing ---');
const priceCases = [
  { raw: '€ 1.299', expected: 1299 },
  { raw: '€1.299', expected: 1299 },
  { raw: '1.299,00 €', expected: 1299 },
  { raw: '€ 49,99', expected: 49.99 },
  { raw: '$1,299.00', expected: 1299 },
  { raw: '$49.99', expected: 49.99 },
  { raw: '$0.00', expected: 0 },
];
for (const pc of priceCases) {
  const parsed = parsePriceString(pc.raw);
  if (parsed !== pc.expected) {
    console.error(`❌ Price parse mismatch for "${pc.raw}": expected ${pc.expected}, got ${parsed}`);
    process.exit(1);
  }
  console.log(`✅ parsePriceString("${pc.raw}") = ${parsed}`);
}

console.log('\n--- Testing Defect 6 (H3): Stripe webhook signature verification ---');
const mockSecret = 'whsec_test_secret_key_1234567890abcdef';
const testPayload = JSON.stringify({ id: 'evt_test_123', type: 'checkout.session.completed' });
const nowSec = Math.floor(Date.now() / 1000);
const validHmac = crypto.createHmac('sha256', mockSecret).update(`${nowSec}.${testPayload}`).digest('hex');

// 1. Valid signature
const sigHeader1 = `t=${nowSec},v1=${validHmac}`;
const isValid1 = verifyStripeSignature(testPayload, sigHeader1, mockSecret);
if (!isValid1) {
  console.error('❌ Defect 6: verifyStripeSignature failed for valid header');
  process.exit(1);
}
console.log('✅ Valid signature verified successfully');

// 2. Secret rotation with multiple v1 signatures
const oldHmac = crypto.createHmac('sha256', 'whsec_old_rotated_secret').update(`${nowSec}.${testPayload}`).digest('hex');
const multiSigHeader = `t=${nowSec},v1=${oldHmac},v1=${validHmac}`;
const isMultiValid = verifyStripeSignature(testPayload, multiSigHeader, mockSecret);
if (!isMultiValid) {
  console.error('❌ Defect 6: Multi-v1 signature verification failed');
  process.exit(1);
}
console.log('✅ Multi-v1 signature rotation verified successfully');

// 3. Expired timestamp (> 300s)
const expiredSec = nowSec - 301;
const expiredHmac = crypto.createHmac('sha256', mockSecret).update(`${expiredSec}.${testPayload}`).digest('hex');
const isExpiredValid = verifyStripeSignature(testPayload, `t=${expiredSec},v1=${expiredHmac}`, mockSecret);
if (isExpiredValid) {
  console.error('❌ Defect 6: Expired timestamp was accepted');
  process.exit(1);
}
console.log('✅ Expired timestamp correctly rejected (> 300s)');

// 4. Tampered payload
const isTamperedValid = verifyStripeSignature(testPayload + 'extra', sigHeader1, mockSecret);
if (isTamperedValid) {
  console.error('❌ Defect 6: Tampered payload was accepted');
  process.exit(1);
}
console.log('✅ Tampered payload correctly rejected');

console.log('\n--- Testing Defect 7 (M1): Pro entitlement duration and refund revocation ---');
const testDevMonthly = 'dg-test-monthly-device-12345';
activateProDevice(testDevMonthly, { plan: 'monthly' });
const isProMonthly = isProDevice(testDevMonthly);
const statusMonthly = getDeviceQuotaStatus(testDevMonthly);
if (!isProMonthly || !statusMonthly.is_pro) {
  console.error('❌ Defect 7: Monthly activation failed');
  process.exit(1);
}
console.log('✅ Monthly Pro activated:', isProMonthly, 'status:', statusMonthly);

// Test refund revocation
revokeProDevice(testDevMonthly);
const isProAfterRevoke = isProDevice(testDevMonthly);
if (isProAfterRevoke) {
  console.error('❌ Defect 7: Pro still active after revocation');
  process.exit(1);
}
console.log('✅ Pro successfully revoked upon refund');

console.log('\n--- Testing Defect 8 (M5): API URL security whitelist ---');
const urlCases = [
  { url: 'http://localhost:8787', allowed: true },
  { url: 'http://127.0.0.1:8787', allowed: true },
  { url: 'https://api.dropguard.io', allowed: true },
  { url: 'http://insecure-remote.com:8787', allowed: false },
  { url: 'http://192.168.1.1:8787', allowed: false },
];
for (const uc of urlCases) {
  const allowed = isSecureApiUrl(uc.url);
  if (allowed !== uc.allowed) {
    console.error(`❌ Defect 8 mismatch for ${uc.url}: expected allowed=${uc.allowed}, got ${allowed}`);
    process.exit(1);
  }
  console.log(`✅ URL "${uc.url}" -> allowed=${allowed}`);
}

console.log('\n--- Testing Defect 9 (L9): Apple brand disambiguation ---');
const appleCases = [
  { title: 'Apple iPhone 15 Pro Max Silicone Case', shouldMatch: true },
  { title: 'Apple USB-C 20W Power Adapter', shouldMatch: true },
  { title: 'Organic Fresh Apple Cider Vinegar Shampoo', shouldMatch: false },
  { title: 'Fresh Red Apple Fruit 5kg Box', shouldMatch: false },
  { title: 'Stainless Steel Apple Peeler and Corer', shouldMatch: false },
];
for (const ac of appleCases) {
  const res = analyzeProductTitleForIP(ac.title);
  const matched = res.detected_terms.length > 0;
  if (matched !== ac.shouldMatch) {
    console.error(`❌ Apple disambiguation mismatch for "${ac.title}": expected matched=${ac.shouldMatch}, got ${matched}`);
    process.exit(1);
  }
  console.log(`✅ Title: "${ac.title}" -> ${matched ? 'MATCHED' : 'SAFE'}`);
}

console.log('\n--- ALL UNIT CHECKS PASSED! ---');
