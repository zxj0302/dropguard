import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Context, Next } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

interface QuotaRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

const DAILY_FREE_LIMIT = 3;
const MAX_MAP_ENTRIES = 5000;
const PRUNE_THROTTLE_MS = 5 * 60 * 1000;

// Regular expression ensuring strict character set and length boundaries:
// 8 to 128 characters, allowing alphanumeric, hyphens, underscores, and dots.
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_.-]{8,128}$/;

/**
 * Validates whether a device ID conforms to security and operational boundaries.
 * Prevents empty strings, whitespace spoofing, and oversized keys in memory maps.
 */
export function isValidDeviceId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  // Reject literal JS type serializations
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') return false;
  return DEVICE_ID_REGEX.test(trimmed);
}

/**
 * Sanitizes and extracts a valid device ID, or returns null if invalid.
 */
export function sanitizeAndValidateDeviceId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return isValidDeviceId(trimmed) ? trimmed : null;
}

// In-memory persistent quota storage (keyed by device_id)
// Can be backed by Cloudflare KV or Redis in production
const deviceQuotas = new Map<string, QuotaRecord>();

// Pro subscriber entitlements with disk persistence.
// Storage path: PRO_DEVICES_FILE env override, otherwise <server dir>/.pro_devices.json
// (resolved from this module's location, NOT process.cwd()).
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRO_FILE = path.resolve(MODULE_DIR, '..', '..', '.pro_devices.json');
const LEGACY_CWD_FILES = [
  path.resolve(process.cwd(), 'server/.pro_devices.json'),
  path.resolve(process.cwd(), '.pro_devices.json'),
];

/** Pro entitlement record. `expiresAt` null/undefined means the entitlement never expires. */
export interface ProRecord {
  expiresAt?: number | null; // epoch ms
  plan?: string;
  activatedAt?: number;
  paymentIntent?: string;
  sessions?: string[]; // processed Stripe checkout session ids (idempotency)
}

const MONTHLY_VALIDITY_MS = 31 * 24 * 3600 * 1000;
const ANNUAL_VALIDITY_MS = 366 * 24 * 3600 * 1000;

function getProStoragePath(): string {
  if (process.env.PRO_DEVICES_FILE) return path.resolve(process.env.PRO_DEVICES_FILE);
  if (fs.existsSync(DEFAULT_PRO_FILE)) return DEFAULT_PRO_FILE;
  for (const legacy of LEGACY_CWD_FILES) {
    if (fs.existsSync(legacy)) return legacy;
  }
  return DEFAULT_PRO_FILE;
}

function parseProData(data: unknown): Map<string, ProRecord> {
  const map = new Map<string, ProRecord>();
  if (Array.isArray(data)) {
    // Legacy format: array of device id strings (never expire)
    for (const id of data) {
      if (isValidDeviceId(id)) map.set(id.trim(), { expiresAt: null });
    }
  } else if (data && typeof data === 'object') {
    const rawDevices =
      (data as { devices?: Record<string, unknown> }).devices ||
      (data as Record<string, unknown>);

    if (rawDevices && typeof rawDevices === 'object') {
      for (const [id, rec] of Object.entries(rawDevices)) {
        if (id === 'version' || !isValidDeviceId(id)) continue;
        const r: ProRecord = {};
        if (typeof rec === 'string' || typeof rec === 'boolean') {
          // Legacy string or boolean -> treat as lifetime (expiresAt = null)
          r.expiresAt = null;
        } else if (rec && typeof rec === 'object') {
          const recObj = rec as Record<string, any>;
          if (typeof recObj.expiresAt === 'number' && Number.isFinite(recObj.expiresAt)) {
            r.expiresAt = recObj.expiresAt;
          } else {
            // No expiresAt or legacy string -> treat as lifetime for backward compatibility
            r.expiresAt = null;
          }
          if (typeof recObj.plan === 'string') r.plan = recObj.plan;
          if (typeof recObj.activatedAt === 'number') r.activatedAt = recObj.activatedAt;
          if (typeof recObj.paymentIntent === 'string') r.paymentIntent = recObj.paymentIntent;
          if (Array.isArray(recObj.sessions)) r.sessions = recObj.sessions.filter((x: any) => typeof x === 'string').slice(-20);
        } else {
          r.expiresAt = null;
        }
        map.set(id.trim(), r);
      }
    } else {
      throw new Error('Unrecognized pro devices file structure');
    }
  } else {
    throw new Error('Unrecognized pro devices file structure');
  }
  return map;
}

function loadPersistedProDevices(): Map<string, ProRecord> {
  const target = getProStoragePath();
  if (!fs.existsSync(target)) return new Map();
  try {
    return parseProData(JSON.parse(fs.readFileSync(target, 'utf-8')));
  } catch (err) {
    // Preserve the unreadable file for manual recovery and try the last known good backup.
    const corruptCopy = `${target}.corrupt-${Date.now()}.bak`;
    console.error(`[DropGuard Quota] ❌ Failed to load Pro devices file ${target}: ${(err as Error)?.message}`);
    try {
      fs.copyFileSync(target, corruptCopy);
      console.error(`[DropGuard Quota] Preserved unreadable file as ${corruptCopy}`);
    } catch (copyErr) {
      console.error(`[DropGuard Quota] Could not preserve unreadable file: ${(copyErr as Error)?.message}`);
    }
    const backup = `${target}.bak`;
    if (fs.existsSync(backup)) {
      try {
        const restored = parseProData(JSON.parse(fs.readFileSync(backup, 'utf-8')));
        console.error(`[DropGuard Quota] Recovered ${restored.size} Pro device(s) from ${backup}`);
        return restored;
      } catch (bakErr) {
        console.error(`[DropGuard Quota] Backup ${backup} also unreadable: ${(bakErr as Error)?.message}`);
      }
    }
    return new Map();
  }
}

/** Atomically persists Pro entitlements (temp file + rename). Returns false (and logs) on failure. */
function savePersistedProDevices(devices: Map<string, ProRecord>): boolean {
  const target = getProStoragePath();
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    const payload = { version: 2, devices: Object.fromEntries(devices) };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    if (fs.existsSync(target)) {
      try {
        fs.copyFileSync(target, `${target}.bak`);
      } catch (bakErr) {
        console.error(`[DropGuard Quota] Could not refresh backup: ${(bakErr as Error)?.message}`);
      }
    }
    fs.renameSync(tmp, target);
    return true;
  } catch (err) {
    console.error(`[DropGuard Quota] ❌ Failed to persist Pro devices to ${target}: ${(err as Error)?.message}`);
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    return false;
  }
}

// Map of activated Pro devices (instant unlock)
const proDevices = loadPersistedProDevices();

/**
 * Enforces hard memory boundaries on ephemeral quota counters to eliminate memory amplification attacks.
 * Strategy: first drop stale (previous-day) records, then only records that never consumed any quota.
 * Records holding today's consumed quota are never evicted, so real users' counts are not reset.
 * Returns true when there is room for a new record.
 * Note: Pro subscriber entitlements (proDevices) are persistent entitlements and MUST NOT be blindly evicted.
 */
export function enforceMemoryMapCap(): boolean {
  if (deviceQuotas.size <= MAX_MAP_ENTRIES) return true;
  const today = getTodayDateString();
  for (const [key, record] of deviceQuotas.entries()) {
    if (record.date !== today) deviceQuotas.delete(key);
  }
  if (deviceQuotas.size <= MAX_MAP_ENTRIES) return true;
  for (const [key, record] of deviceQuotas.entries()) {
    if (record.count === 0) deviceQuotas.delete(key);
  }
  return deviceQuotas.size <= MAX_MAP_ENTRIES;
}

export interface ActivateOptions {
  /** 'monthly' (31 days) or 'annual' (366 days). Omit for a non-expiring (admin/dev) activation. */
  plan?: 'monthly' | 'annual';
  /** Stripe checkout session id; used to make activation idempotent (webhook + redirect). */
  sessionId?: string;
  paymentIntent?: string;
}

export function activateProDevice(deviceId: string, options: ActivateOptions = {}): boolean {
  const safeId = sanitizeAndValidateDeviceId(deviceId);
  if (!safeId) return false;

  const now = Date.now();
  const existing = proDevices.get(safeId);

  // Idempotency: the same checkout session must only extend entitlement once
  if (options.sessionId && existing?.sessions?.includes(options.sessionId)) return true;

  const next: ProRecord = { ...(existing || {}) };
  next.activatedAt = now;
  if (options.plan) {
    const duration = options.plan === 'annual' ? ANNUAL_VALIDITY_MS : MONTHLY_VALIDITY_MS;
    const wasPermanent = existing !== undefined && (existing.expiresAt === null || existing.expiresAt === undefined);
    if (wasPermanent) {
      next.expiresAt = null; // never downgrade a non-expiring entitlement
    } else {
      const base = Math.max(now, existing?.expiresAt ?? now);
      next.expiresAt = base + duration;
    }
    next.plan = options.plan;
  } else {
    next.expiresAt = null; // admin/dev activation: non-expiring
  }
  if (options.paymentIntent) next.paymentIntent = options.paymentIntent;
  if (options.sessionId) next.sessions = [...(existing?.sessions || []), options.sessionId].slice(-20);

  proDevices.set(safeId, next);
  if (!savePersistedProDevices(proDevices)) {
    console.error(`[DropGuard Quota] ⚠️ Pro for ${safeId} is active in memory only (persist failed).`);
  }
  return true;
}

export function isProDevice(deviceId: string): boolean {
  const safeId = sanitizeAndValidateDeviceId(deviceId);
  if (!safeId) return false;
  const rec = proDevices.get(safeId);
  if (!rec) return false;
  if (typeof rec.expiresAt === 'number' && rec.expiresAt <= Date.now()) return false;
  return true;
}

/** Revokes Pro for a device (admin reset or refund). Returns true if a record was removed. */
export function revokeProDevice(deviceId: string): boolean {
  const safeId = sanitizeAndValidateDeviceId(deviceId);
  if (!safeId || !proDevices.has(safeId)) return false;
  proDevices.delete(safeId);
  savePersistedProDevices(proDevices);
  return true;
}

/** Finds the device bound to a Stripe PaymentIntent (used for refund handling). */
export function findDeviceByPaymentIntent(paymentIntent: string): string | null {
  if (!paymentIntent) return null;
  for (const [id, rec] of proDevices.entries()) {
    if (rec.paymentIntent === paymentIntent) return id;
  }
  return null;
}

const DEFAULT_UPGRADE_HOST = 'localhost:8787';

/**
 * Safely constructs the Pro upgrade URL without trusting unvalidated client headers (prevents Host injection & phishing redirects).
 */
export function generateSafeUpgradeUrl(c: Context, deviceId: string): string {
  // 1. Explicit environment configuration takes highest precedence
  const configuredBaseUrl = process.env.APP_BASE_URL || process.env.PUBLIC_URL || process.env.UPGRADE_BASE_URL;
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl);
      return `${parsed.origin}/pricing?deviceId=${encodeURIComponent(deviceId)}`;
    } catch {
      // Ignore invalid URL format in env and fallback to whitelist check
    }
  }

  // 2. Strict Host Whitelist validation
  const allowedHosts = new Set<string>([
    'localhost:8787',
    '127.0.0.1:8787',
    'localhost',
    '127.0.0.1',
    ...(process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase()) : []),
  ]);

  // When behind multiple reverse proxies or CDNs (e.g. Cloudflare + Nginx), X-Forwarded-Host may contain a comma-separated list.
  // Take the first client host, then strip any trailing path or slash.
  const rawHeader = c.req.header('x-forwarded-host') || c.req.header('host') || '';
  const firstHostSegment = rawHeader.split(',')[0].trim();
  const candidateHost = firstHostSegment.split('/')[0].trim().toLowerCase();

  const host = allowedHosts.has(candidateHost) ? candidateHost : DEFAULT_UPGRADE_HOST;

  const rawProtoHeader = c.req.header('x-forwarded-proto') || '';
  const firstProto = rawProtoHeader.split(',')[0].trim().toLowerCase();
  const proto =
    firstProto === 'https' || firstProto === 'http'
      ? firstProto
      : host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https';

  return `${proto}://${host}/pricing?deviceId=${encodeURIComponent(deviceId)}`;
}

/**
 * Returns current UTC date string formatted as YYYY-MM-DD
 */
function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculates ISO timestamp for the next midnight UTC reset
 */
function getNextResetIsoString(): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

let lastPruneTimestamp = 0;

// Per-IP daily free-scan counters: stops free quota farming by rotating X-Device-Id values.
const IP_DAILY_FREE_LIMIT = Number(process.env.IP_DAILY_FREE_LIMIT) > 0 ? Number(process.env.IP_DAILY_FREE_LIMIT) : 30;
const MAX_IP_ENTRIES = 20000;
const ipQuotas = new Map<string, QuotaRecord>();

// Prune expired records to prevent unbounded memory leak over time
function pruneExpiredQuotas() {
  const now = Date.now();
  // Throttle daily date pruning to run at most once every 5 minutes
  if (now - lastPruneTimestamp >= PRUNE_THROTTLE_MS) {
    lastPruneTimestamp = now;
    const today = getTodayDateString();
    for (const [key, record] of deviceQuotas.entries()) {
      if (record.date !== today) {
        deviceQuotas.delete(key);
      }
    }
  }

  // Prune stale per-IP counters
  const todayIp = getTodayDateString();
  for (const [ip, rec] of ipQuotas.entries()) {
    if (rec.date !== todayIp) ipQuotas.delete(ip);
  }
}

/**
 * Resolves the client IP. X-Forwarded-For is only trusted when TRUST_PROXY=true
 * (i.e. the server sits behind a reverse proxy that overwrites the header).
 */
function getClientIp(c: Context): string {
  if (process.env.TRUST_PROXY === 'true') {
    const xff = c.req.header('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0].trim();
      if (first) return first;
    }
    const real = c.req.header('x-real-ip');
    if (real) return real.trim();
  }
  try {
    return getConnInfo(c).remote.address || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Quota middleware enforcing 3 free requests per device per day.
 * Returns HTTP 402 with QUOTA_EXCEEDED when exceeded.
 */
export async function quotaMiddleware(c: Context, next: Next) {
  // Periodically prune stale device records if memory map grows
  if (deviceQuotas.size > 500) {
    pruneExpiredQuotas();
  }

  const rawDeviceId = c.req.header('x-device-id') || c.req.header('X-Device-Id');
  if (!rawDeviceId || (typeof rawDeviceId === 'string' && !rawDeviceId.trim())) {
    return c.json(
      {
        error: 'MISSING_DEVICE_ID',
        message: 'Missing required authentication header: X-Device-Id',
      },
      400
    );
  }

  const deviceId = sanitizeAndValidateDeviceId(rawDeviceId);
  if (!deviceId) {
    return c.json(
      {
        error: 'INVALID_DEVICE_ID',
        message: 'Invalid X-Device-Id header. Must be 8-128 characters containing only alphanumeric characters, hyphens, underscores, or dots.',
      },
      400
    );
  }

  // Bypass quota checks for Pro subscribers
  if (isProDevice(deviceId)) {
    c.header('X-Quota-Limit', '999999');
    c.header('X-Quota-Remaining', '999999');
    c.header('X-Quota-Reset', getNextResetIsoString());
    c.header('X-User-Tier', 'PRO');
    await next();
    return;
  }

  const today = getTodayDateString();
  const currentRecord = deviceQuotas.get(deviceId);

  if (!currentRecord || currentRecord.date !== today) {
    // New day or new device -> reset quota to 0 (never evicts today's consumed records)
    if (!currentRecord && !enforceMemoryMapCap()) {
      return c.json({ error: 'SERVICE_BUSY', message: 'Quota tracking capacity reached. Please try again later.' }, 503);
    }
    deviceQuotas.set(deviceId, { date: today, count: 0 });
  }

  const record = deviceQuotas.get(deviceId)!;

  // Per-IP dimension: cap total free scans from one address regardless of device id rotation
  const clientIp = getClientIp(c);
  let ipRecord = ipQuotas.get(clientIp);
  if (!ipRecord || ipRecord.date !== today) {
    if (!ipRecord && ipQuotas.size >= MAX_IP_ENTRIES) pruneExpiredQuotas();
    ipRecord = { date: today, count: 0 };
    ipQuotas.set(clientIp, ipRecord);
  }
  if (ipRecord.count >= IP_DAILY_FREE_LIMIT && record.count < DAILY_FREE_LIMIT) {
    c.header('X-Quota-Limit', String(DAILY_FREE_LIMIT));
    c.header('X-Quota-Remaining', '0');
    c.header('X-Quota-Reset', getNextResetIsoString());
    return c.json(
      {
        error: 'RATE_LIMITED',
        message: 'Too many free scans from this network today. Upgrade to Pro or try again tomorrow.',
        remaining_quota: 0,
        reset_at: getNextResetIsoString(),
        upgrade_url: generateSafeUpgradeUrl(c, deviceId),
      },
      429
    );
  }

  if (record.count >= DAILY_FREE_LIMIT) {
    const upgradeUrl = generateSafeUpgradeUrl(c, deviceId);

    c.header('X-Quota-Limit', String(DAILY_FREE_LIMIT));
    c.header('X-Quota-Remaining', '0');
    c.header('X-Quota-Reset', getNextResetIsoString());

    return c.json(
      {
        error: 'QUOTA_EXCEEDED',
        message: `Daily free quota exceeded (${DAILY_FREE_LIMIT}/${DAILY_FREE_LIMIT} scans used). Upgrade to Pro for unlimited real-time IP defense and sourcing analytics.`,
        current_usage: record.count,
        limit: DAILY_FREE_LIMIT,
        remaining_quota: 0,
        reset_at: getNextResetIsoString(),
        upgrade_url: upgradeUrl,
      },
      402
    );
  }

  // Pre-increment quota atomically to prevent TOCTOU race conditions from concurrent calls
  record.count += 1;
  ipRecord.count += 1;
  const countedIpRecord = ipRecord;

  try {
    await next();
  } finally {
    // Only keep consumed quota if the handler processed successfully (2xx or 3xx status)
    // Ensures client bad requests (400) or server errors (500) do not consume quota
    if (!c.res || c.res.status < 200 || c.res.status >= 400) {
      record.count = Math.max(0, record.count - 1);
      countedIpRecord.count = Math.max(0, countedIpRecord.count - 1);
    }

    const remaining = Math.max(0, DAILY_FREE_LIMIT - record.count);

    // Set response headers for client visibility
    c.header('X-Quota-Limit', String(DAILY_FREE_LIMIT));
    c.header('X-Quota-Remaining', String(remaining));
    c.header('X-Quota-Reset', getNextResetIsoString());
  }
}

/**
 * Helper to inspect or reset quota (useful for testing)
 */
export function getDeviceQuotaStatus(deviceId: string) {
  const safeId = sanitizeAndValidateDeviceId(deviceId);
  if (!safeId) {
    return {
      date: getTodayDateString(),
      used: 0,
      remaining: 0,
      limit: DAILY_FREE_LIMIT,
      is_pro: false,
      error: 'INVALID_DEVICE_ID',
    };
  }

  const isPro = isProDevice(safeId);
  if (isPro) {
    return {
      date: getTodayDateString(),
      used: 0,
      remaining: 999999,
      limit: 999999,
      is_pro: true,
    };
  }

  const today = getTodayDateString();
  const record = deviceQuotas.get(safeId);
  if (!record || record.date !== today) {
    return { date: today, used: 0, remaining: DAILY_FREE_LIMIT, limit: DAILY_FREE_LIMIT, is_pro: false };
  }
  return {
    date: today,
    used: record.count,
    remaining: Math.max(0, DAILY_FREE_LIMIT - record.count),
    limit: DAILY_FREE_LIMIT,
    is_pro: false,
  };
}

export function resetDeviceQuota(deviceId: string, revokePro = false) {
  const safeId = sanitizeAndValidateDeviceId(deviceId);
  if (!safeId) return;
  deviceQuotas.delete(safeId);
  if (revokePro) {
    revokeProDevice(safeId);
  }
}
