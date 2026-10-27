import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { bodyLimit } from 'hono/body-limit';
import {
  quotaMiddleware,
  getDeviceQuotaStatus,
  getDeviceQuotaStatusAsync,
  resetDeviceQuota,
  activateProDevice,
  activateProDeviceAsync,
  isProDevice,
  isProDeviceAsync,
  revokeProDevice,
  revokeProDeviceAsync,
  findDeviceByPaymentIntent,
  findDeviceByPaymentIntentAsync,
  sanitizeAndValidateDeviceId,
} from './middleware/quota.js';
import { analyzeProductTitleForIP } from './services/ipRadar.js';
import { analyzeSourcing, SourceFinderRequest } from './services/sourceFinder.js';

export type CloudflareBindings = {
  DROP_GUARD_KV?: any;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  CHECKOUT_SECRET?: string;
  ADMIN_KEY?: string;
  ADMIN_SECRET?: string;
  NODE_ENV?: string;
  TRUST_PROXY?: string;
  APP_BASE_URL?: string;
  PUBLIC_URL?: string;
  UPGRADE_BASE_URL?: string;
};

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Load .env file automatically if present
try {
  const envCandidates = ['./server/.env', '.env', path.resolve(process.cwd(), 'server/.env'), path.resolve(process.cwd(), '.env')];
  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(candidate);
      } else {
        const content = fs.readFileSync(candidate, 'utf-8');
        for (const line of content.split('\n')) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = (match[2] || '').trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
          }
        }
      }
      break;
    }
  }
} catch {
  // ignore
}

// Shared checkout token secret & one-time replay tracking.
// CHECKOUT_SECRET must be an explicit strong value; otherwise a random per-process secret is generated
// (tokens then do not survive restarts, which is acceptable: they are a dev-only simulation aid).
// It is intentionally never derived from ADMIN_KEY and has no hard-coded default.
const CHECKOUT_SECRET: string =
  process.env.CHECKOUT_SECRET && process.env.CHECKOUT_SECRET.length >= 16
    ? process.env.CHECKOUT_SECRET
    : crypto.randomBytes(32).toString('hex');
if (!process.env.CHECKOUT_SECRET || process.env.CHECKOUT_SECRET.length < 16) {
  console.warn('[DropGuard Server] CHECKOUT_SECRET not set (or shorter than 16 chars); generated a random one for this process.');
}
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_TIMEOUT_MS = 10_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;
const CHECKOUT_TOKEN_TTL_MS = 24 * 3600 * 1000;
const MAX_USED_TOKENS = 100_000;

const USED_TOKENS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.used_tokens.json');

function loadPersistedUsedTokens(): Map<string, number> {
  const map = new Map<string, number>();
  try {
    if (fs.existsSync(USED_TOKENS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USED_TOKENS_FILE, 'utf-8'));
      const now = Date.now();
      if (data && typeof data === 'object') {
        for (const [t, exp] of Object.entries(data)) {
          if (typeof exp === 'number' && exp > now) {
            map.set(t, exp);
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return map;
}

function persistUsedTokens(tokens: Map<string, number>) {
  try {
    const now = Date.now();
    const obj: Record<string, number> = {};
    for (const [t, exp] of tokens) {
      if (exp > now) obj[t] = exp;
    }
    const tmp = `${USED_TOKENS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf-8');
    fs.renameSync(tmp, USED_TOKENS_FILE);
  } catch {
    // ignore
  }
}

// token -> expiry timestamp (ms); only expired entries are ever pruned, so a used token is never "forgotten" early
const usedCheckoutTokens = loadPersistedUsedTokens();

/**
 * Explicit development mode: only NODE_ENV=development enables simulation and open admin endpoints.
 * Anything else (unset, production, test, ...) is treated as locked-down.
 */
export function isDevMode(c?: Context): boolean {
  if (c?.env?.NODE_ENV) return c.env.NODE_ENV === 'development';
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
}

/**
 * Generates a tamper-proof HMAC-signed checkout token for simulated payments (development mode only).
 */
export function generateCheckoutToken(deviceId: string, secretOverride?: string): string {
  const secret = secretOverride || CHECKOUT_SECRET;
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${deviceId}:${timestamp}:${nonce}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

/**
 * Validates a checkout token asynchronously, checking both in-memory cache and Cloudflare KV.
 */
export async function verifyAndConsumeCheckoutTokenAsync(deviceId: string, token: string, kv?: any, secretOverride?: string): Promise<boolean> {
  try {
    if (!token || typeof token !== 'string') return false;
    if (usedCheckoutTokens.has(token)) return false;

    if (kv && typeof kv.get === 'function') {
      const isUsed = await kv.get(`token:${token}`);
      if (isUsed) return false;
    }

    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [tokenDeviceId, timestampStr, nonce, hmac] = parts;
    const timestamp = Number(timestampStr);

    if (tokenDeviceId !== deviceId) return false;
    // Allow tokens valid within 24 hours
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > CHECKOUT_TOKEN_TTL_MS || Date.now() < timestamp - 60000) {
      return false;
    }

    const secret = secretOverride || CHECKOUT_SECRET;
    const payload = `${tokenDeviceId}:${timestampStr}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const given = Buffer.from(hmac, 'hex');
    const expected = Buffer.from(expectedHmac, 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

    // Prune only expired entries; fail closed if the replay set is still full
    if (usedCheckoutTokens.size >= MAX_USED_TOKENS) {
      const now = Date.now();
      for (const [t, exp] of usedCheckoutTokens) {
        if (exp <= now) usedCheckoutTokens.delete(t);
      }
      if (usedCheckoutTokens.size >= MAX_USED_TOKENS) return false;
    }
    usedCheckoutTokens.set(token, timestamp + CHECKOUT_TOKEN_TTL_MS);

    if (kv && typeof kv.put === 'function') {
      try {
        await kv.put(`token:${token}`, '1', { expirationTtl: Math.ceil(CHECKOUT_TOKEN_TTL_MS / 1000) });
      } catch {
        // ignore
      }
    }

    persistUsedTokens(usedCheckoutTokens);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a checkout token, ensuring signature validity, expiry window (24h), device match, and single-use consumption.
 */
export function verifyAndConsumeCheckoutToken(deviceId: string, token: string): boolean {
  try {
    if (!token || typeof token !== 'string') return false;
    if (usedCheckoutTokens.has(token)) return false;

    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [tokenDeviceId, timestampStr, nonce, hmac] = parts;
    const timestamp = Number(timestampStr);

    if (tokenDeviceId !== deviceId) return false;
    // Allow tokens valid within 24 hours
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > CHECKOUT_TOKEN_TTL_MS || Date.now() < timestamp - 60000) {
      return false;
    }

    const payload = `${tokenDeviceId}:${timestampStr}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', CHECKOUT_SECRET).update(payload).digest('hex');
    const given = Buffer.from(hmac, 'hex');
    const expected = Buffer.from(expectedHmac, 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;

    // Prune only expired entries; fail closed if the replay set is still full
    if (usedCheckoutTokens.size >= MAX_USED_TOKENS) {
      const now = Date.now();
      for (const [t, exp] of usedCheckoutTokens) {
        if (exp <= now) usedCheckoutTokens.delete(t);
      }
      if (usedCheckoutTokens.size >= MAX_USED_TOKENS) return false;
    }
    usedCheckoutTokens.set(token, timestamp + CHECKOUT_TOKEN_TTL_MS);
    persistUsedTokens(usedCheckoutTokens);
    return true;
  } catch {
    return false;
  }
}

/**
 * Escapes characters for safe interpolation into HTML templates to prevent Reflected XSS.
 */
function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Constant-time string comparison (hashes first so differing lengths do not leak). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Guard to verify if internal administrative endpoints are accessible.
 * Default deny: open only when NODE_ENV=development is set explicitly; otherwise a configured
 * ADMIN_KEY must be supplied via the X-Admin-Key or Authorization: Bearer header (never via query string).
 * Without an ADMIN_KEY, administrative endpoints always return 403 outside development.
 */
export function isDevOrAdminAuthorized(c: any): boolean {
  if (isDevMode(c)) return true;

  const adminKey =
    c?.env?.ADMIN_KEY ||
    c?.env?.ADMIN_SECRET ||
    (typeof process !== 'undefined' ? (process.env?.ADMIN_KEY || process.env?.ADMIN_SECRET) : '');
  if (!adminKey) return false;

  const reqAdminKey = c.req.header('x-admin-key') || '';
  const authHeader = c.req.header('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  return (reqAdminKey !== '' && safeEqual(reqAdminKey, adminKey)) || (bearerToken !== '' && safeEqual(bearerToken, adminKey));
}

/**
 * Resolves the public base URL used for Stripe redirect URLs. Never derived from request headers.
 * APP_BASE_URL is required outside development mode.
 */
function getAppBaseUrl(c?: any): string | null {
  const configured =
    c?.env?.APP_BASE_URL ||
    c?.env?.PUBLIC_URL ||
    (typeof process !== 'undefined' ? (process.env?.APP_BASE_URL || process.env?.RENDER_EXTERNAL_URL) : '');
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  if (isDevMode(c)) return `http://localhost:${(typeof process !== 'undefined' && Number(process.env?.PORT)) || 8787}`;
  return null;
}

/**
 * Verifies a Stripe-Signature header (t=...,v1=...[,v1=...]) against the raw body.
 * Enforces timestamp tolerance (replay protection), supports multiple v1 signatures (secret rotation)
 * and compares in constant time after a length check.
 */
export function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string, nowMs = Date.now()): boolean {
  if (!secret || !sigHeader) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const item of sigHeader.split(',')) {
    const idx = item.indexOf('=');
    if (idx <= 0) continue;
    const k = item.slice(0, idx).trim();
    const v = item.slice(idx + 1).trim();
    if (k === 't') timestamp = v;
    else if (k === 'v1' && v) signatures.push(v);
  }
  const ts = Number(timestamp);
  if (!timestamp || !Number.isFinite(ts) || signatures.length === 0) return false;
  if (Math.abs(nowMs / 1000 - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'), 'hex');
  for (const sig of signatures) {
    if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length % 2 !== 0) continue;
    const given = Buffer.from(sig, 'hex');
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return true;
  }
  return false;
}

/**
 * Activates Pro from a Stripe Checkout Session object that has been authenticated by the caller
 * (webhook signature or server-side session retrieval). Requires payment_status === 'paid'.
 * Returns the activated device id, or null.
 */
async function activateFromPaidSession(session: any, kv?: any): Promise<string | null> {
  if (!session || session.payment_status !== 'paid') return null;
  const dev = sanitizeAndValidateDeviceId(session.client_reference_id || session.metadata?.device_id || '');
  if (!dev) return null;
  const plan = session.metadata?.plan === 'annual' ? 'annual' : 'monthly';
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
  const ok = await activateProDeviceAsync(
    dev,
    {
      plan,
      sessionId: typeof session.id === 'string' ? session.id : undefined,
      paymentIntent,
    },
    kv
  );
  return ok ? dev : null;
}

// Global Middlewares
app.use('*', logger());
// Request body size limit (L1)
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 256 * 1024,
    onError: (c) => c.json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' }, 413),
  })
);
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Device-Id', 'Authorization', 'X-Admin-Key', 'X-Checkout-Token', 'Stripe-Signature'],
    exposeHeaders: ['X-Quota-Limit', 'X-Quota-Remaining', 'X-Quota-Reset', 'X-User-Tier'],
    maxAge: 86400,
  })
);

// 1. Health Check
app.get('/health', (c) => {
  const stripeKey = (c.env as any)?.STRIPE_SECRET_KEY || (typeof process !== 'undefined' ? process.env?.STRIPE_SECRET_KEY : '') || '';
  return c.json({
    status: 'ok',
    service: 'DropGuard Radar Server',
    version: '1.0.0',
    platform: (c.env as any)?.DROP_GUARD_KV ? 'cloudflare-workers' : 'node',
    stripe_configured: Boolean(stripeKey),
    timestamp: new Date().toISOString(),
    uptime_seconds: typeof process !== 'undefined' && typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0,
  });
});

// 2. Interactive Pricing & Stripe Checkout Landing Page
app.get('/pricing', async (c) => {
  const rawDeviceId = c.req.query('deviceId') || '';
  const validatedId = sanitizeAndValidateDeviceId(rawDeviceId);
  const deviceId = validatedId || '';
  const ref = c.req.query('ref') || 'direct';
  const initialLang = (c.req.query('lang') || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const safeDeviceId = escapeHtml(deviceId);
  // Simulated checkout (and its token) exists ONLY in explicit development mode
  const simulationEnabled = isDevMode(c);
  const checkoutToken = simulationEnabled && deviceId ? generateCheckoutToken(deviceId) : '';
  const stripeKey = (c.env as any)?.STRIPE_SECRET_KEY || (typeof process !== 'undefined' ? process.env?.STRIPE_SECRET_KEY : '') || '';
  const hasStripe = Boolean(stripeKey);
  const isSuccessRedirect = c.req.query('success') === 'true';
  const sessionId = c.req.query('session_id') || '';

  // If returning from real Stripe Checkout with session_id, verify payment server-side and activate.
  // This (and the signed webhook) is the only production activation path.
  if (isSuccessRedirect && sessionId && stripeKey) {
    try {
      const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
        signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.payment_status === 'paid') {
          const dev = await activateFromPaidSession(sData, (c.env as any)?.DROP_GUARD_KV);
          if (dev) {
            console.log(`[DropGuard Stripe Redirect] 🎉 Verified paid session ${sessionId}! Activated PRO for device: ${dev}`);
          }
        }
      }
    } catch (err) {
      console.error(`[DropGuard Stripe Redirect] Session verification failed: ${(err as Error)?.message}`);
    }
  }

  const isCurrentlyPro = Boolean(deviceId && (await isProDeviceAsync(deviceId, (c.env as any)?.DROP_GUARD_KV)));

  const html = `<!DOCTYPE html>
<html lang="${initialLang}" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DropGuard Pro - Upgrade & Pricing</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              500: '#0ea5e9',
              600: '#0284c7',
            }
          }
        }
      }
    }
  </script>
  <style>
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.7; }
    }
    .glow-aura {
      animation: pulseGlow 4s ease-in-out infinite;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased selection:bg-cyan-500 selection:text-white">

  <!-- Background decorative light gradients -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden">
    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 rounded-full blur-[100px] glow-aura"></div>
  </div>

  <div class="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:py-16">
    <!-- Navigation Header -->
    <header class="flex items-center justify-between border-b border-slate-800/80 pb-6 mb-12">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 font-black text-xl">
          🛡️
        </div>
        <div>
          <span class="text-lg font-black tracking-wider uppercase text-white">DropGuard</span>
          <span class="ml-1.5 px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">PRO</span>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Language Switcher Button -->
        <button
          onclick="togglePageLanguage()"
          id="langSwitchBtn"
          class="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-sm"
        >
          <span>🌐</span>
          <span id="langSwitchLabel">中文</span>
        </button>

        <div class="text-xs text-slate-400 hidden sm:block">
          <span data-i18n="connectedDevice">Device:</span> <span id="displayDeviceId" class="font-mono text-cyan-400 font-semibold">${safeDeviceId || 'Not connected'}</span>
        </div>
      </div>
    </header>

    ${isCurrentlyPro ? `
    <!-- Active Pro Notification Banner -->
    <div class="mb-10 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 p-6 shadow-2xl backdrop-blur-xl text-center ring-1 ring-emerald-500/30">
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2 border border-emerald-500/40">
        <span>✨</span> <span data-i18n="proActiveBadge">ACTIVE PRO MEMBER</span> <span>✨</span>
      </div>
      <h3 class="text-xl sm:text-2xl font-black text-white" data-i18n="proActiveHeading">
        🎉 Your Device is Active on DropGuard PRO
      </h3>
      <p class="mt-2 text-xs sm:text-sm text-slate-300 max-w-xl mx-auto" data-i18n="proActiveSub">
        Device <span class="font-mono text-cyan-400 font-bold">${safeDeviceId}</span> has unlimited trademark scans, fuzzy risk alerts, and factory profit calculators enabled.
      </p>
    </div>
    ` : ''}

    <!-- Hero Title -->
    <div class="text-center max-w-2xl mx-auto mb-14">
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold mb-4" data-i18n="badge">
        ⚡ E-Commerce Intellectual Property Defense & Factory Sourcing Intelligence
      </span>
      <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
        <span data-i18n="heroH1">Upgrade to DropGuard Pro</span><br/>
        <span class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent" data-i18n="heroH2">
          Eliminate Legal TROs & Maximize Margins
        </span>
      </h1>
      <p class="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed" data-i18n="heroP">
        Safeguard your Shopify and dropshipping stores against predatory law firm TROs. Scan 35+ registered trademark and patent databases in real time and uncover 1688 ex-works factory prices.
      </p>
    </div>

    <!-- Pricing Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-16">
      <!-- Pro Monthly -->
      <div class="relative rounded-2xl border-2 border-cyan-500/60 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
        <div class="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[11px] font-bold tracking-wider uppercase shadow-md" data-i18n="popular">
          Most Popular
        </div>

        <div>
          <div class="text-sm font-bold text-cyan-400 tracking-wider uppercase" data-i18n="monthlyPlan">Pro Monthly Plan</div>
          <div class="mt-4 flex items-baseline gap-1">
            <span class="text-5xl font-black text-white">$29</span>
            <span class="text-slate-400 text-sm font-semibold" data-i18n="perMonth">/ month</span>
          </div>
          <p class="mt-2 text-xs text-slate-300" data-i18n="monthlyDesc">One-time payment, Pro valid for 31 days (no auto-renewal). Ideal for scaling dropshippers and high-frequency product testing.</p>

          <hr class="my-6 border-slate-800" />

          <ul class="space-y-3 text-xs text-slate-200">
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="mFeature1"><strong>Unlimited Real-Time IP Trademark Scans</strong> (35+ brand databases)</span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="mFeature2"><strong>Levenshtein Fuzzy Brand Variation Detection</strong></span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="mFeature3"><strong>1688 & AliExpress Factory Ex-Works Margin Calculator</strong></span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="mFeature4"><strong>Shopify Store Theme & Catalog Feed Spy</strong></span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="mFeature5"><strong>Meta & TikTok Ad Breakeven CPA Limit Model</strong></span>
            </li>
          </ul>
        </div>

        <button ${isCurrentlyPro ? 'disabled' : `onclick="handleSubscribe(29, 'monthly')"`} class="mt-8 w-full py-3.5 px-4 rounded-xl ${isCurrentlyPro ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 cursor-default' : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:opacity-95 active:scale-[0.98] text-white shadow-lg shadow-cyan-500/25'} font-bold text-sm flex items-center justify-center gap-2 transition">
          <span data-i18n="${isCurrentlyPro ? 'btnActivePlan' : 'btnMonthly'}">${isCurrentlyPro ? '✓ Pro Plan Active' : 'Start Pro Monthly ($29)'}</span>
          ${isCurrentlyPro ? '' : '<span>→</span>'}
        </button>
      </div>

      <!-- Pro Annual -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur-xl flex flex-col justify-between hover:border-slate-700 transition">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-indigo-400 tracking-wider uppercase" data-i18n="annualPlan">Pro Annual Plan</span>
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/30" data-i18n="savePercent">Save 42%</span>
          </div>

          <div class="mt-4 flex items-baseline gap-1">
            <span class="text-5xl font-black text-white">$199</span>
            <span class="text-slate-400 text-sm font-semibold" data-i18n="perYear">/ year</span>
          </div>
          <p class="mt-2 text-xs text-slate-300" data-i18n="annualDesc">One-time payment, Pro valid for 366 days (no auto-renewal) — just $16.50/month equivalent. Complete year-round defense with priority custom trademark watchlist support.</p>

          <hr class="my-6 border-slate-800" />

          <ul class="space-y-3 text-xs text-slate-200">
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="aFeature1">Includes all Pro Monthly features</span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="aFeature2"><strong>Priority Updates for Emerging High-Risk TRO Targets</strong></span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="aFeature3"><strong>Valid for 366 days from purchase</strong></span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="text-emerald-400 font-bold">✓</span>
              <span data-i18n="aFeature4">24/7 Priority Discord & Email Compliance Support</span>
            </li>
          </ul>
        </div>

        <button ${isCurrentlyPro ? 'disabled' : `onclick="handleSubscribe(199, 'annual')"`} class="mt-8 w-full py-3.5 px-4 rounded-xl ${isCurrentlyPro ? 'bg-slate-800/60 border border-slate-700 text-slate-400 cursor-default' : 'bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white border border-slate-700'} font-bold text-sm flex items-center justify-center gap-2 transition">
          <span data-i18n="${isCurrentlyPro ? 'btnActivePlan' : 'btnAnnual'}">${isCurrentlyPro ? '✓ Pro Plan Active' : 'Start Pro Annual ($199/yr)'}</span>
          ${isCurrentlyPro ? '' : '<span>→</span>'}
        </button>
      </div>
    </div>

    <!-- Security & Guarantee Badge -->
    <div class="text-center text-xs text-slate-400 flex flex-wrap items-center justify-center gap-6 py-4 border-t border-slate-900">
      <div class="flex items-center gap-1.5">
        <span class="text-emerald-400 font-bold">✓</span>
        <span data-i18n="guarantee1">Bank-Grade 256-Bit SSL Encryption</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-emerald-400 font-bold">✓</span>
        <span data-i18n="guarantee2">Instant Device License Activation</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-emerald-400 font-bold">✓</span>
        <span data-i18n="guarantee3">14-Day Money-Back Guarantee</span>
      </div>
    </div>
  </div>

  <!-- Simulated or Live Checkout Modal Container -->
  <div id="checkoutModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 hidden">
    <div class="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
      <!-- Close button -->
      <button onclick="closeCheckoutModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white transition">
        ✕
      </button>

      <div class="flex items-center gap-3 mb-5">
        <div class="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          💳
        </div>
        <div>
          <h3 class="text-base font-bold text-white" id="modalCheckoutTitle">Stripe Quick Checkout (Simulation)</h3>
          <p class="text-xs text-slate-400" id="modalCheckoutSubtitle">One-click device license activation</p>
        </div>
      </div>

      <!-- Device ID Input Section -->
      <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 mb-5 space-y-2">
        <div class="flex items-center justify-between">
          <label for="inputDeviceId" class="text-slate-200 font-bold text-xs flex items-center gap-1.5">
            <span>🔑 <span data-i18n="modalDeviceLabel">Plugin Device ID</span></span>
            <span class="text-rose-400 font-bold">*</span>
          </label>
          <span class="text-[10px] text-cyan-400 font-medium" data-i18n="modalDeviceHelp">Click to copy at extension footer</span>
        </div>
        <div class="relative">
          <input
            id="inputDeviceId"
            type="text"
            required
            placeholder="e.g. dg-usr-1740000000000-xxxx"
            value="${safeDeviceId}"
            class="w-full rounded-lg border ${!safeDeviceId ? 'border-amber-500/80 bg-amber-950/20 text-amber-200 focus:border-amber-400' : 'border-slate-700 bg-slate-950 text-white focus:border-cyan-500'} px-3 py-2 font-mono text-xs focus:outline-none transition"
            oninput="handleDeviceIdInput(this.value)"
          />
        </div>
        <p id="deviceIdHelpText" class="text-[11px] ${!safeDeviceId ? 'text-amber-300/90' : 'text-slate-400'} leading-tight">
          ${!safeDeviceId 
            ? '⚠️ No device ID detected. Please copy your Device ID from the bottom of the DropGuard extension.' 
            : '✓ Pro tier will be bound directly to device ' + safeDeviceId}
        </p>
      </div>

      <!-- Plan Summary Card -->
      <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4 mb-5">
        <div class="flex justify-between items-center text-xs mb-2">
          <span class="text-slate-400" id="modalPlanName">DropGuard Pro Monthly ($29/mo)</span>
          <span class="font-bold text-white font-mono" id="modalAmount">$29.00 USD</span>
        </div>
        <div class="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span data-i18n="tax">Taxes & Fees</span>
          <span class="font-mono text-slate-300">$0.00</span>
        </div>
      </div>

      <!-- Payment Form -->
      <form id="paymentForm" onsubmit="handlePaymentSubmit(event)" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1" data-i18n="cardNumber">Credit / Debit Card</label>
          <div class="rounded-lg border border-slate-700 bg-slate-950 p-2.5 flex items-center justify-between text-xs font-mono text-slate-300">
            <span>•••• •••• •••• 4242</span>
            <span class="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">TEST / DEMO</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label class="block font-medium text-slate-300 mb-1" data-i18n="expiry">MM/YY</label>
            <div class="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-slate-400">
              12/28
            </div>
          </div>
          <div>
            <label class="block font-medium text-slate-300 mb-1" data-i18n="cvc">CVC</label>
            <div class="rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-slate-400">
              •••
            </div>
          </div>
        </div>

        <button
          type="submit"
          id="payButton"
          class="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 active:scale-[0.98] transition font-bold text-white text-xs shadow-lg shadow-emerald-500/20"
        >
          <span data-i18n="payConfirm">Authorize & Instantly Activate Pro</span>
        </button>
      </form>

      <!-- Success Screen -->
      <div id="successBanner" class="hidden text-center py-6 space-y-4">
        <div class="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-black ring-4 ring-emerald-500/10">
          ✓
        </div>
        <div>
          <h4 class="text-base font-bold text-white" data-i18n="successTitle">Payment Authorized & Pro Activated!</h4>
          <p class="text-xs text-slate-300 mt-1">
            <span data-i18n="successDesc">Device</span> <span id="activatedDeviceIdDisplay" class="font-mono text-cyan-400 font-bold"></span> <span data-i18n="successDesc2">has been upgraded to Pro tier. Please reopen the DropGuard extension to enjoy unlimited access.</span>
          </p>
        </div>
        <button onclick="closeAndReturn()" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition" data-i18n="closeBtn">
          Close Window
        </button>
      </div>
    </div>
  </div>

  <script>
    let activePrice = 29;
    let targetDeviceId = "${safeDeviceId}";
    let currentCheckoutToken = "${checkoutToken}";
    const simulationEnabled = ${simulationEnabled};
    const hasStripeBackend = ${hasStripe};
    let currentLang = "${initialLang}";

    const i18nDict = {
      en: {
        connectedDevice: 'Device:',
        badge: '⚡ E-Commerce Intellectual Property Defense & Factory Sourcing Intelligence',
        heroH1: 'Upgrade to DropGuard Pro',
        heroH2: 'Eliminate Legal TROs & Maximize Margins',
        heroP: 'Safeguard your Shopify and dropshipping stores against predatory law firm TROs. Scan 35+ registered trademark and patent databases in real time and uncover 1688 ex-works factory prices.',
        popular: 'Most Popular',
        monthlyPlan: 'Pro Monthly Plan',
        perMonth: '/ month',
        monthlyDesc: 'One-time payment, Pro valid for 31 days (no auto-renewal). Ideal for scaling dropshippers and high-frequency product testing.',
        mFeature1: '<strong>Unlimited Real-Time IP Trademark Scans</strong> (35+ brand databases)',
        mFeature2: '<strong>Levenshtein Fuzzy Brand Variation Detection</strong>',
        mFeature3: '<strong>1688 & AliExpress Factory Ex-Works Margin Calculator</strong>',
        mFeature4: '<strong>Shopify Store Theme & Catalog Feed Spy</strong>',
        mFeature5: '<strong>Meta & TikTok Ad Breakeven CPA Limit Model</strong>',
        proActiveBadge: 'ACTIVE PRO MEMBER',
        proActiveHeading: '🎉 DropGuard PRO Active on this Device',
        proActiveSub: 'Device {deviceId} is fully activated with unlimited real-time trademark scans, fuzzy risk alerts, and 1688 profit calculations.',
        btnActivePlan: '✓ Pro Plan Active',
        btnMonthly: 'Start Pro Monthly ($29)',
        annualPlan: 'Pro Annual Plan',
        savePercent: 'Save 42%',
        perYear: '/ year',
        annualDesc: 'One-time payment, Pro valid for 366 days (no auto-renewal) — just $16.50/month equivalent. Complete year-round defense with priority custom trademark watchlist support.',
        aFeature1: 'Includes all Pro Monthly features',
        aFeature2: '<strong>Priority Updates for Emerging High-Risk TRO Targets</strong>',
        aFeature3: '<strong>Valid for 366 days from purchase</strong>',
        aFeature4: '24/7 Priority Discord & Email Compliance Support',
        btnAnnual: 'Start Pro Annual ($199/yr)',
        guarantee1: 'Bank-Grade 256-Bit SSL Encryption',
        guarantee2: 'Instant Device License Activation',
        guarantee3: '14-Day Money-Back Guarantee',
        modalDeviceLabel: 'Plugin Device ID',
        modalDeviceHelp: 'Click to copy at extension footer',
        tax: 'Taxes & Fees',
        cardNumber: 'Credit / Debit Card',
        expiry: 'MM/YY',
        cvc: 'CVC',
        payConfirm: 'Authorize & Instantly Activate Pro',
        successTitle: 'Payment Authorized & Pro Activated!',
        successDesc: 'Device',
        successDesc2: 'has been upgraded to Pro tier. Please reopen the DropGuard extension to enjoy unlimited access.',
        closeBtn: 'Close Window',
        langSwitchLabel: '中文',
      },
      zh: {
        connectedDevice: '已关联设备:',
        badge: '⚡ 跨境电商独立站法务防御与源头选品专家',
        heroH1: '升级 DropGuard Pro',
        heroH2: '阻断侵权冻结，直达源头底价',
        heroP: '告别 GBC / Keith 律所跨境 TRO 资产冻结风险。实时扫描 35+ 高危品牌库，一键逆向 1688 出厂利润。',
        popular: '最受欢迎',
        monthlyPlan: 'Pro 月度订阅',
        perMonth: '/ 月',
        monthlyDesc: '一次性付款，Pro 有效期 31 天（不会自动续费）。适合正处于快速起量与高频选品期的跨境独立站卖家。',
        mFeature1: '<strong>无限次实时侵权排查</strong>（35+ 品牌与专利高危库）',
        mFeature2: '<strong>Levenshtein 智能防规避拼写模糊检测</strong>',
        mFeature3: '<strong>1688 / AliExpress 智能图搜与出厂底价估算</strong>',
        mFeature4: '<strong>Shopify 模板架构与竞品爆品流一键逆向</strong>',
        mFeature5: '<strong>Meta & TikTok 广告保本 CPA 测算模型</strong>',
        proActiveBadge: 'PRO 尊享版会员已生效',
        proActiveHeading: '🎉 当前设备已成功激活 DropGuard PRO',
        proActiveSub: '设备 {deviceId} 已获得无限制特权：实时侵权雷达、防规避模糊检测与 1688 源头利润测算均已全面解锁，可在 Chrome 插件中畅享使用！',
        btnActivePlan: '✓ 当前已激活 PRO 权益',
        btnMonthly: '立即开通 Pro 月度版 ($29)',
        annualPlan: 'Pro 年度订阅',
        savePercent: '立省 42%',
        perYear: '/ 年',
        annualDesc: '一次性付款，Pro 有效期 366 天（不会自动续费），折合仅 $16.5/月。全年无忧防御，支持优先工单与专属品牌词库定制。',
        aFeature1: '包含月度版所有全部 Pro 功能',
        aFeature2: '<strong>优先收录高危律所最新起诉品牌与外观专利</strong>',
        aFeature3: '<strong>自购买之日起 366 天内有效</strong>',
        aFeature4: '7x24 小时法务咨询与出海合规指引',
        btnAnnual: '开通 Pro 年度版 ($199/年)',
        guarantee1: '金融级 256 位 SSL 安全加密传输',
        guarantee2: '支付后设备秒级自动授权激活',
        guarantee3: '14 天无理由全额退款保障',
        modalDeviceLabel: '插件 Device ID',
        modalDeviceHelp: '请在 Chrome 插件底部点击复制',
        tax: '税费及手续费',
        cardNumber: '信用卡 / 借记卡 (支持中银/Visa/MasterCard/银联)',
        expiry: '有效月/年',
        cvc: '安全码 CVC',
        payConfirm: '确认安全支付并秒级激活 Pro',
        successTitle: '支付成功，Pro 特权已生效！',
        successDesc: '设备',
        successDesc2: '已成功晋升为 PRO 会员。请重新打开 DropGuard 插件尽享无限次排查！',
        closeBtn: '关闭页面',
        langSwitchLabel: 'English',
      }
    };

    function applyTranslations(lang) {
      currentLang = lang;
      const dict = i18nDict[lang] || i18nDict.en;
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
          let text = dict[key];
          if (targetDeviceId && text.includes('{deviceId}')) {
            text = text.replace('{deviceId}', '<span class="font-mono text-cyan-400 font-bold">' + targetDeviceId + '</span>');
          }
          el.innerHTML = text;
        }
      });
      document.getElementById('langSwitchLabel').textContent = dict.langSwitchLabel;
    }

    function togglePageLanguage() {
      const next = currentLang === 'zh' ? 'en' : 'zh';
      applyTranslations(next);
      const url = new URL(window.location.href);
      url.searchParams.set('lang', next);
      window.history.replaceState({}, '', url.toString());
    }

    applyTranslations(currentLang);

    function handleDeviceIdInput(val) {
      const trimmed = (val || '').trim();
      targetDeviceId = trimmed;
      const displaySpan = document.getElementById('displayDeviceId');
      if (displaySpan) {
        displaySpan.textContent = trimmed || (currentLang === 'zh' ? '未检测到设备' : 'Not connected');
      }
      const helpText = document.getElementById('deviceIdHelpText');
      if (helpText) {
        if (!trimmed) {
          helpText.className = 'text-[11px] text-amber-300/90 leading-tight';
          helpText.textContent = currentLang === 'zh' ? '⚠️ 未输入 Device ID。请在 DropGuard 插件底部复制您的 Device ID 填入。' : '⚠️ No Device ID entered. Please copy your Device ID from the bottom of DropGuard.';
        } else {
          helpText.className = 'text-[11px] text-slate-400 leading-tight';
          helpText.textContent = currentLang === 'zh' ? '✓ 支付后将即时为设备 ' + trimmed + ' 激活 Pro 权限。' : '✓ Pro tier will be activated for device ' + trimmed;
        }
      }
    }

    async function handleSubscribe(amount, plan) {
      const inputEl = document.getElementById('inputDeviceId');
      const devId = (inputEl ? inputEl.value : targetDeviceId).trim();

      if (!devId) {
        alert(currentLang === 'zh' ? '请先输入有效的 Device ID。' : 'Please enter a valid Device ID first.');
        return;
      }

      // If Stripe backend is configured, use Stripe hosted checkout
      if (hasStripeBackend) {
        try {
          const res = await fetch('/api/v1/create-stripe-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: devId, plan })
          });
          const data = await res.json();
          if (data.checkout_url) {
            window.location.href = data.checkout_url;
            return;
          }
          if (!simulationEnabled) {
            alert((currentLang === 'zh' ? '无法创建支付会话：' : 'Could not start checkout: ') + (data.message || 'unknown error'));
            return;
          }
        } catch {
          if (!simulationEnabled) {
            alert(currentLang === 'zh' ? '无法连接支付服务，请稍后重试。' : 'Could not reach the payment service. Please try again later.');
            return;
          }
        }
      }

      // Simulated checkout modal exists only in explicit development mode
      if (!simulationEnabled) {
        alert(currentLang === 'zh' ? '支付暂不可用，请稍后重试。' : 'Payments are currently unavailable. Please try again later.');
        return;
      }
      openCheckoutModal(amount, plan);
    }

    function openCheckoutModal(amount, plan) {
      activePrice = amount;
      document.getElementById('modalAmount').textContent = '$' + amount + '.00 USD';
      document.getElementById('modalPlanName').textContent = plan === 'annual' ? 'DropGuard Pro Annual ($199/yr)' : 'DropGuard Pro Monthly ($29/mo)';
      const inputEl = document.getElementById('inputDeviceId');
      if (inputEl && targetDeviceId) {
        inputEl.value = targetDeviceId;
      }
      handleDeviceIdInput(inputEl ? inputEl.value : targetDeviceId);
      document.getElementById('checkoutModal').classList.remove('hidden');
    }

    function closeCheckoutModal() {
      document.getElementById('checkoutModal').classList.add('hidden');
    }

    async function handlePaymentSubmit(e) {
      e.preventDefault();
      const inputEl = document.getElementById('inputDeviceId');
      const devId = (inputEl ? inputEl.value : targetDeviceId).trim();

      if (!devId || devId === 'default-device') {
        alert(currentLang === 'zh' ? '请输入有效的 Device ID！请在 DropGuard 插件底部复制您的设备 ID。' : 'Please provide a valid Device ID copied from DropGuard extension footer.');
        inputEl?.focus();
        return;
      }

      const btn = document.getElementById('payButton');
      btn.disabled = true;
      btn.innerHTML = '<span class="inline-block animate-spin mr-1">⏳</span> ' + (currentLang === 'zh' ? '正在处理授权并激活 Pro...' : 'Processing and activating Pro...');

      try {
        let tokenToUse = currentCheckoutToken;
        if (!tokenToUse || devId !== "${safeDeviceId}") {
          const tokenRes = await fetch('/api/v1/checkout-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: devId })
          });
          if (!tokenRes.ok) {
            const errData = await tokenRes.json().catch(() => ({}));
            if (tokenRes.status === 403) {
              throw new Error(currentLang === 'zh' ? '生产环境下禁止手动签发模拟令牌，请通过插件点击升级链接打开。' : 'Manual token generation is restricted in production.');
            }
            throw new Error(errData.message || 'Invalid Device ID format');
          }
          const tokenJson = await tokenRes.json();
          tokenToUse = tokenJson.checkout_token;
        }

        const res = await fetch('/api/v1/activate-pro', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tokenToUse ? { 'X-Checkout-Token': tokenToUse } : {})
          },
          body: JSON.stringify({
            device_id: devId,
            checkout_token: tokenToUse
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Activation failed: ' + res.status);
        }

        const activatedDevIdSpan = document.getElementById('activatedDeviceIdDisplay');
        if (activatedDevIdSpan) {
          activatedDevIdSpan.textContent = devId;
        }

        setTimeout(() => {
          document.getElementById('paymentForm').classList.add('hidden');
          document.getElementById('successBanner').classList.remove('hidden');
        }, 600);
      } catch (err) {
        alert((currentLang === 'zh' ? '支付处理失败：' : 'Payment failed: ') + (err.message || 'Please try again later'));
        btn.disabled = false;
        btn.textContent = currentLang === 'zh' ? '确认安全支付并秒级激活 Pro' : 'Authorize & Instantly Activate Pro';
      }
    }

    function closeAndReturn() {
      window.close();
      closeCheckoutModal();
    }
  </script>
</body>
</html>`;

  return c.html(html);
});

// 2.1 Checkout Token Generator Endpoint
app.post('/api/v1/checkout-token', async (c) => {
  try {
    if (!isDevMode()) {
      return c.json(
        {
          error: 'FORBIDDEN',
          message: 'Checkout token generation (simulated payments) is only available when NODE_ENV=development.',
        },
        403
      );
    }

    const body = await c.req.json<{ device_id?: string }>().catch(() => ({} as { device_id?: string }));
    const rawDeviceId = body?.device_id || c.req.query('deviceId') || '';
    const deviceId = sanitizeAndValidateDeviceId(rawDeviceId);
    if (!deviceId) {
      return c.json({ error: 'INVALID_DEVICE_ID', message: 'Valid device_id is required' }, 400);
    }
    const token = generateCheckoutToken(deviceId);
    return c.json({ status: 'ok', checkout_token: token, device_id: deviceId });
  } catch {
    return c.json({ error: 'SERVER_ERROR', message: 'Failed to generate checkout token' }, 500);
  }
});

// 2.2 Official Stripe Checkout Session Creator
app.post('/api/v1/create-stripe-checkout', async (c) => {
  try {
    const stripeKey = (c.env as any)?.STRIPE_SECRET_KEY || (typeof process !== 'undefined' ? process.env?.STRIPE_SECRET_KEY : '') || '';
    if (!stripeKey) {
      if (isDevMode(c)) {
        return c.json({ simulated: true, message: 'Stripe secret key not configured. Using local checkout simulation.' });
      }
      return c.json({ error: 'PAYMENTS_UNAVAILABLE', message: 'Payments are not configured.' }, 503);
    }

    const body = await c.req.json<{ device_id?: string; plan?: 'monthly' | 'annual' }>().catch(() => ({} as any));
    const deviceId = sanitizeAndValidateDeviceId(body?.device_id || '');
    if (!deviceId) {
      return c.json({ error: 'INVALID_DEVICE_ID', message: 'Valid device_id is required' }, 400);
    }

    const plan = body?.plan === 'annual' ? 'annual' : 'monthly';
    // Redirect base comes from configuration only; request headers are never trusted
    const origin = getAppBaseUrl(c);
    if (!origin) {
      console.error('[DropGuard Server] APP_BASE_URL is not configured; refusing to create Stripe session.');
      return c.json({ error: 'SERVER_MISCONFIGURED', message: 'Payments are not configured.' }, 503);
    }

    const params = new URLSearchParams({
      'client_reference_id': deviceId,
      'metadata[device_id]': deviceId,
      'metadata[plan]': plan,
      'payment_intent_data[metadata][device_id]': deviceId,
      'payment_intent_data[metadata][plan]': plan,
      'mode': 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': plan === 'annual' ? 'DropGuard Pro Annual (366 days, one-time)' : 'DropGuard Pro Monthly (31 days, one-time)',
      'line_items[0][price_data][unit_amount]': plan === 'annual' ? '19900' : '2900',
      'line_items[0][quantity]': '1',
      'success_url': `${origin}/pricing?success=true&deviceId=${encodeURIComponent(deviceId)}&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/pricing?canceled=true&deviceId=${encodeURIComponent(deviceId)}`,
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });

    if (!stripeRes.ok) {
      const errJson = await stripeRes.json().catch(() => ({}));
      return c.json({ error: 'STRIPE_ERROR', message: errJson?.error?.message || 'Failed to create Stripe session' }, 502);
    }

    const stripeSession = await stripeRes.json();
    return c.json({ checkout_url: stripeSession.url, session_id: stripeSession.id });
  } catch (err: any) {
    return c.json({ error: 'SERVER_ERROR', message: err?.message || 'Stripe initialization failed' }, 500);
  }
});

// 2.3 Official Stripe Webhook Endpoint (signature verification is mandatory)
app.post('/api/v1/stripe-webhook', async (c) => {
  try {
    const webhookSecret = (c.env as any)?.STRIPE_WEBHOOK_SECRET || (typeof process !== 'undefined' ? process.env?.STRIPE_WEBHOOK_SECRET : '') || '';
    if (!webhookSecret) {
      console.error('[DropGuard Stripe Webhook] Rejected: STRIPE_WEBHOOK_SECRET is not configured.');
      return c.json({ error: 'WEBHOOK_NOT_CONFIGURED', message: 'STRIPE_WEBHOOK_SECRET is not configured' }, 500);
    }

    const rawBody = await c.req.text();
    const sigHeader = c.req.header('stripe-signature') || '';
    if (!sigHeader) {
      return c.json({ error: 'MISSING_SIGNATURE' }, 400);
    }
    if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
      return c.json({ error: 'SIGNATURE_VERIFICATION_FAILED' }, 401);
    }

    const event = JSON.parse(rawBody);
    const obj = event?.data?.object;

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      // Delayed payment methods complete as 'unpaid' first; only a 'paid' session activates Pro
      const dev = await activateFromPaidSession(obj, (c.env as any)?.DROP_GUARD_KV);
      if (dev) {
        console.log(`[DropGuard Stripe Webhook] 🎉 Payment verified! Activated PRO for device: ${dev}`);
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      // charge.refunded fires on partial refunds too; only revoke when fully refunded. Disputes always revoke.
      const fullyRefunded = event.type === 'charge.dispute.created' || obj?.refunded === true;
      if (fullyRefunded) {
        const paymentIntent = typeof obj?.payment_intent === 'string' ? obj.payment_intent : '';
        const dev =
          (await findDeviceByPaymentIntentAsync(paymentIntent, (c.env as any)?.DROP_GUARD_KV)) ||
          sanitizeAndValidateDeviceId(obj?.metadata?.device_id || '');
        if (dev && (await revokeProDeviceAsync(dev, (c.env as any)?.DROP_GUARD_KV))) {
          console.log(`[DropGuard Stripe Webhook] Revoked PRO for device ${dev} (${event.type})`);
        }
      }
    }

    return c.json({ received: true });
  } catch (err: any) {
    return c.json({ error: 'WEBHOOK_ERROR', message: err?.message }, 400);
  }
});

// 3. Activate Pro License for a Device
app.post('/api/v1/activate-pro', async (c) => {
  try {
    const body = await c.req.json<{ device_id?: string; checkout_token?: string }>().catch(() => ({} as { device_id?: string; checkout_token?: string }));
    const rawDeviceId = body?.device_id || c.req.header('x-device-id') || c.req.header('X-Device-Id');
    if (!rawDeviceId || (typeof rawDeviceId === 'string' && !rawDeviceId.trim())) {
      return c.json({ error: 'MISSING_DEVICE_ID', message: 'Field device_id or header X-Device-Id required' }, 400);
    }
    const deviceId = sanitizeAndValidateDeviceId(rawDeviceId);
    if (!deviceId) {
      return c.json({ error: 'INVALID_DEVICE_ID', message: 'Invalid device ID format. Must be 8-128 characters containing only alphanumeric characters, hyphens, underscores, or dots.' }, 400);
    }

    const isAdmin = isDevOrAdminAuthorized(c);
    // Checkout tokens (simulated payments) are honoured ONLY in explicit development mode
    const checkoutToken = body?.checkout_token || c.req.header('x-checkout-token') || '';
    const isCheckoutValid = isDevMode(c) && checkoutToken ? await verifyAndConsumeCheckoutTokenAsync(deviceId, checkoutToken, (c.env as any)?.DROP_GUARD_KV) : false;

    if (!isAdmin && !isCheckoutValid) {
      return c.json(
        {
          error: 'FORBIDDEN',
          message: 'This endpoint requires admin credentials. Pro is activated automatically after a verified Stripe payment.',
        },
        403
      );
    }

    await activateProDeviceAsync(deviceId, {}, (c.env as any)?.DROP_GUARD_KV);
    console.log(`[DropGuard Server] 🎉 Device ${deviceId} upgraded to PRO tier!`);
    return c.json({
      status: 'ok',
      tier: 'PRO',
      message: `Pro successfully activated for device ${deviceId}`,
      unlimited: true,
    });
  } catch {
    return c.json({ error: 'SERVER_ERROR', message: 'Failed to activate Pro' }, 500);
  }
});

// 4. Check Device Quota Status (does not deduct quota)
app.get('/api/v1/quota-status', async (c) => {
  const rawDeviceId = c.req.header('x-device-id') || c.req.header('X-Device-Id');
  if (!rawDeviceId || (typeof rawDeviceId === 'string' && !rawDeviceId.trim())) {
    return c.json({ error: 'MISSING_DEVICE_ID', message: 'Header X-Device-Id required' }, 400);
  }
  const deviceId = sanitizeAndValidateDeviceId(rawDeviceId);
  if (!deviceId) {
    return c.json({ error: 'INVALID_DEVICE_ID', message: 'Invalid X-Device-Id header. Must be 8-128 characters containing only alphanumeric characters, hyphens, underscores, or dots.' }, 400);
  }
  const status = await getDeviceQuotaStatusAsync(deviceId, (c.env as any)?.DROP_GUARD_KV);
  return c.json(status);
});

// 5. Reset Device Quota (Dev/Testing Utility)
app.post('/api/v1/reset-quota', async (c) => {
  if (!isDevOrAdminAuthorized(c)) {
    return c.json(
      {
        error: 'FORBIDDEN',
        message: 'This administrative endpoint is restricted in production. Valid admin credentials required.',
      },
      403
    );
  }

  try {
    const body = await c.req.json<{ device_id?: string; revoke_pro?: boolean }>().catch(() => ({} as { device_id?: string; revoke_pro?: boolean }));
    const rawDeviceId = body?.device_id || c.req.header('x-device-id') || c.req.header('X-Device-Id');
    if (!rawDeviceId || (typeof rawDeviceId === 'string' && !rawDeviceId.trim())) {
      return c.json({ error: 'MISSING_DEVICE_ID', message: 'Field device_id or header X-Device-Id required' }, 400);
    }
    const deviceId = sanitizeAndValidateDeviceId(rawDeviceId);
    if (!deviceId) {
      return c.json({ error: 'INVALID_DEVICE_ID', message: 'Invalid device ID format. Must be 8-128 characters containing only alphanumeric characters, hyphens, underscores, or dots.' }, 400);
    }
    resetDeviceQuota(deviceId, body?.revoke_pro === true);
    if (body?.revoke_pro === true && (c.env as any)?.DROP_GUARD_KV) {
      await revokeProDeviceAsync(deviceId, (c.env as any)?.DROP_GUARD_KV);
    }
    return c.json({ status: 'ok', message: `Quota reset for device ${deviceId}` });
  } catch {
    return c.json({ error: 'SERVER_ERROR', message: 'Failed to reset quota' }, 500);
  }
});

// 6. IP Infringement Radar Check (Protected by Quota Middleware)
app.post('/api/v1/ip-check', quotaMiddleware, async (c) => {
  try {
    const body = await c.req.json<{
      product_title?: string;
      product_image?: string;
    }>().catch(() => null);

    if (!body || typeof body.product_title !== 'string' || !body.product_title.trim()) {
      return c.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Field "product_title" is required in request body and must be a non-empty string.',
        },
        400
      );
    }

    if (body.product_image !== undefined && body.product_image !== null && typeof body.product_image !== 'string') {
      return c.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Field "product_image" must be a string if provided.',
        },
        400
      );
    }

    if (body.product_title.length > 500) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Field "product_title" must be at most 500 characters.' }, 400);
    }
    if (typeof body.product_image === 'string' && body.product_image.length > 2048) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Field "product_image" must be at most 2048 characters.' }, 400);
    }

    const result = analyzeProductTitleForIP(body.product_title);
    return c.json(result);
  } catch (err: any) {
    return c.json(
      {
        error: 'SERVER_ERROR',
        message: err?.message || 'Failed to analyze IP infringement',
      },
      500
    );
  }
});

// 7. Source Finder & Margin Calculator (Protected by Quota Middleware)
app.post('/api/v1/source-finder', quotaMiddleware, async (c) => {
  try {
    const body = await c.req.json<SourceFinderRequest>().catch(() => null);

    if (!body || typeof body.product_title !== 'string' || !body.product_title.trim()) {
      return c.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Field "product_title" is required in request body and must be a non-empty string.',
        },
        400
      );
    }

    // Validate product_image if provided
    if (body.product_image !== undefined && body.product_image !== null && typeof body.product_image !== 'string') {
      return c.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Field "product_image" must be a string if provided.',
        },
        400
      );
    }

    if (body.product_title.length > 500) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Field "product_title" must be at most 500 characters.' }, 400);
    }
    if (typeof body.product_image === 'string' && body.product_image.length > 2048) {
      return c.json({ error: 'INVALID_REQUEST', message: 'Field "product_image" must be at most 2048 characters.' }, 400);
    }

    // Validate currency (3-letter code) if provided
    if (body.currency !== undefined && body.currency !== null) {
      if (typeof body.currency !== 'string' || !/^[A-Za-z]{3}$/.test(body.currency.trim())) {
        return c.json({ error: 'INVALID_REQUEST', message: 'Field "currency" must be a 3-letter currency code.' }, 400);
      }
      body.currency = body.currency.trim().toUpperCase();
    }

    // Validate retail_price if provided
    if (body.retail_price !== undefined && body.retail_price !== null) {
      const parsed = typeof body.retail_price === 'number' ? body.retail_price : Number(body.retail_price);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
        return c.json(
          {
            error: 'INVALID_REQUEST',
            message: 'Field "retail_price" must be a valid finite number between 0 and 1,000,000.',
          },
          400
        );
      }
      body.retail_price = Number(parsed.toFixed(2));
    }

    const result = analyzeSourcing(body);
    return c.json(result);
  } catch (err: any) {
    return c.json(
      {
        error: 'SERVER_ERROR',
        message: err?.message || 'Failed to analyze sourcing parameters',
      },
      500
    );
  }
});

// Fallback 404 Route
app.notFound((c) => {
  return c.json({ error: 'NOT_FOUND', message: 'API route not found' }, 404);
});

/**
 * Starts the HTTP server listener.
 */
export function startServer(customPort?: number) {
  const port = customPort ?? (Number(process.env.PORT) || 8787);
  const server = serve({
    fetch: app.fetch,
    port,
  });
  console.log(`[DropGuard Server] Listening on http://localhost:${port}`);
  return server;
}

/**
 * Checks whether this module is directly executed as the main application entrypoint.
 */
export function isMainModule(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_SERVER_AUTOSTART === 'true') {
    return false;
  }
  if (!process.argv || !process.argv[1]) {
    return false;
  }

  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const executedFilePath = path.resolve(process.argv[1]);

    if (currentFilePath === executedFilePath) {
      return true;
    }

    try {
      if (fs.realpathSync(currentFilePath) === fs.realpathSync(executedFilePath)) {
        return true;
      }
    } catch {
      // Ignored
    }

    const stripExt = (p: string) => p.replace(/\.[cm]?[jt]sx?$/, '');
    return stripExt(currentFilePath) === stripExt(executedFilePath);
  } catch {
    return false;
  }
}

let serverInstance: ReturnType<typeof serve> | null = null;
if (isMainModule()) {
  serverInstance = startServer();
}

export { app, serverInstance };
export default app;
