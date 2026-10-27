/**
 * Device Identity Management
 * Generates and persists a unique Device UUID in chrome.storage.local
 */

const DEVICE_ID_KEY = 'dropguard_device_id';
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_.-]{8,128}$/;

/**
 * Validates device ID string format and length boundaries.
 */
export function isValidDeviceId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return false;
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') return false;
  return DEVICE_ID_REGEX.test(trimmed);
}

/**
 * Generates a RFC4122 v4 UUID with fallback for non-secure contexts (e.g. http:// development stores)
 */
function generateSafeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // ignore
    }
  }
  // Safe math fallback adhering to v4 structure
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Ephemeral in-memory fallback to avoid host-page window.localStorage cross-site pollution & credential leakage
let inMemoryDeviceId: string | null = null;
let creationInFlight: Promise<string> | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(DEVICE_ID_KEY);
      const candidate = stored[DEVICE_ID_KEY];
      if (isValidDeviceId(candidate)) {
        return candidate.trim();
      }

      // Delegate first-time creation to background service worker to serialize across multiple tabs
      if (chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        try {
          const bgResponse = await new Promise<{ deviceId?: string }>((resolve) => {
            const timeout = setTimeout(() => resolve({}), 2000);
            chrome.runtime.sendMessage({ type: 'GET_OR_CREATE_DEVICE_ID' }, (resp) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError || !resp) {
                resolve({});
              } else {
                resolve(resp);
              }
            });
          });
          if (isValidDeviceId(bgResponse.deviceId)) {
            return bgResponse.deviceId.trim();
          }
        } catch {
          // Fall back to storage mutex
        }
      }

      // Serialize first-time creation within this context to avoid in-page races
      if (!creationInFlight) {
        creationInFlight = (async () => {
          const newId = generateSafeUUID();
          // Re-read right before writing: another tab/context may have created an ID in the meantime
          const again = (await chrome.storage.local.get(DEVICE_ID_KEY))[DEVICE_ID_KEY];
          if (isValidDeviceId(again)) return again.trim();
          await chrome.storage.local.set({ [DEVICE_ID_KEY]: newId });
          // Read back so that, if two contexts raced, all of them converge on whichever value persisted last
          const final = (await chrome.storage.local.get(DEVICE_ID_KEY))[DEVICE_ID_KEY];
          return isValidDeviceId(final) ? final.trim() : newId;
        })().finally(() => {
          creationInFlight = null;
        });
      }
      return await creationInFlight;
    }
  } catch (err) {
    console.warn('[DropGuard] Failed to access chrome.storage.local, using in-memory device ID', err);
  }

  // In-memory fallback: guarantees strict cross-site isolation without leaking or polluting host page localStorage
  if (!inMemoryDeviceId || !isValidDeviceId(inMemoryDeviceId)) {
    inMemoryDeviceId = generateSafeUUID();
  }
  return inMemoryDeviceId;
}

