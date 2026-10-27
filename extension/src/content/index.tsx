import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import cssText from './styles.css?inline';
import { FloatingButton } from '../components/FloatingButton';
import { DrawerModal } from '../components/DrawerModal';
import { detectShopify, ShopifyDetectionResult } from '../utils/shopifyDetector';
import { getOrCreateDeviceId } from '../utils/device';
import { Language, getDefaultLanguage, STORAGE_LANG_KEY } from '../i18n';

const HOST_CONTAINER_ID = 'dropguard-root';

interface DropGuardAppProps {
  detectionResult: ShopifyDetectionResult;
  deviceId: string;
  defaultOpen?: boolean;
}

let externalToggleDrawer: (() => void) | null = null;

const DropGuardApp: React.FC<DropGuardAppProps> = ({ detectionResult, deviceId, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [detectedCount, setDetectedCount] = useState(0);
  const [lang, setLang] = useState<Language>(getDefaultLanguage());

  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(STORAGE_LANG_KEY).then((res) => {
          if (res && (res[STORAGE_LANG_KEY] === 'en' || res[STORAGE_LANG_KEY] === 'zh')) {
            setLang(res[STORAGE_LANG_KEY]);
          }
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    console.log('[DropGuard] Mounted inside Shadow DOM with Device UUID:', deviceId);
    console.log('[DropGuard] Shopify Signals:', detectionResult.matchedSignals);

    externalToggleDrawer = () => {
      setIsOpen((prev) => !prev);
    };

    return () => {
      externalToggleDrawer = null;
    };
  }, [deviceId, detectionResult]);

  return (
    <div className="dropguard-shadow-wrapper text-slate-100 font-sans antialiased">
      <FloatingButton
        isOpen={isOpen}
        onToggleDrawer={() => setIsOpen((prev) => !prev)}
        detectedCount={detectedCount}
        isShopify={detectionResult.isShopify}
        lang={lang}
      />
      <DrawerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        deviceId={deviceId}
        isShopify={detectionResult.isShopify}
        onDetectedCountChange={(count) => setDetectedCount(count)}
        lang={lang}
        onLangChange={setLang}
      />
    </div>
  );
};

// Robust cross-world SPA navigation detector (survives Isolated World boundary)
let currentUrl = window.location.href;
function checkSpaLocationChange() {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    window.dispatchEvent(new Event('locationchange'));
    // If DropGuard host element is missing or was detached by dynamic DOM replacement, re-probe
    const existingHost = document.getElementById(HOST_CONTAINER_ID);
    if (!existingHost || !existingHost.isConnected) {
      initializeDropGuard(false, false);
    }
  }
}

window.addEventListener('popstate', checkSpaLocationChange);
window.addEventListener('hashchange', checkSpaLocationChange);

// Modern Chromium Navigation API listener
if (typeof window !== 'undefined' && 'navigation' in window) {
  try {
    (window as any).navigation.addEventListener('navigate', () => {
      setTimeout(checkSpaLocationChange, 100);
    });
  } catch {
    // Ignore unsupported
  }
}

// Low-overhead periodic URL change poller as fail-safe for pushState in main world
setInterval(checkSpaLocationChange, 800);

// Guard against re-entrant concurrent initialization and race condition on toolbar click
let isInitializing = false;
let pendingForceMount = false;
let pendingAutoOpen = false;

// Singleton reference to current React 18 Root to prevent memory leaks and duplicate roots on SPA remounts
let currentReactRoot: ReactDOM.Root | null = null;

/**
 * Initializes DropGuard inside an isolated Shadow DOM.
 */
async function initializeDropGuard(forceMount = false, autoOpen = false) {
  // Prevent duplicate mounts or concurrent executions
  if (document.getElementById(HOST_CONTAINER_ID)) {
    if (autoOpen && externalToggleDrawer) {
      externalToggleDrawer();
    }
    return;
  }

  if (isInitializing) {
    if (forceMount) pendingForceMount = true;
    if (autoOpen) pendingAutoOpen = true;
    return;
  }
  isInitializing = true;

  try {
    let currentForceMount = forceMount || pendingForceMount;
    let currentAutoOpen = autoOpen || pendingAutoOpen;
    pendingForceMount = false;
    pendingAutoOpen = false;

    let detection: ShopifyDetectionResult;
    if (currentForceMount) {
      detection = {
        isShopify: false,
        confidence: 'none',
        matchedSignals: ['Manual activation via Toolbar action'],
      };
    } else {
      console.log('[DropGuard] Probing page for Shopify signals...');
      detection = await detectShopify();

      // Check if manual toolbar activation occurred while detectShopify was probing
      if (pendingForceMount) {
        currentForceMount = true;
        currentAutoOpen = currentAutoOpen || pendingAutoOpen;
        pendingForceMount = false;
        pendingAutoOpen = false;
        detection = {
          isShopify: false,
          confidence: 'none',
          matchedSignals: ['Manual activation via Toolbar action'],
        };
      } else if (!detection.isShopify) {
        console.log('[DropGuard] Non-Shopify store or no Shopify footprint detected. Standby.');
        return;
      } else {
        console.log('[DropGuard] Shopify store confirmed! Confidence:', detection.confidence, detection.matchedSignals);
      }
    }

    currentAutoOpen = currentAutoOpen || pendingAutoOpen;
    pendingAutoOpen = false;

    // Double-check host container was not mounted during async detectShopify probe
    if (document.getElementById(HOST_CONTAINER_ID)) {
      if (currentAutoOpen && externalToggleDrawer) {
        externalToggleDrawer();
      }
      return;
    }

    // Generate or retrieve persistent Device UUID
    const deviceId = await getOrCreateDeviceId();

    // 1. Create Host Element in Host DOM
    const hostContainer = document.createElement('div');
    hostContainer.id = HOST_CONTAINER_ID;
    // Enforce !important styles to prevent any host page global CSS clobbering
    hostContainer.style.setProperty('position', 'fixed', 'important');
    hostContainer.style.setProperty('z-index', '2147483647', 'important');
    hostContainer.style.setProperty('top', '0', 'important');
    hostContainer.style.setProperty('left', '0', 'important');
    hostContainer.style.setProperty('width', '0', 'important');
    hostContainer.style.setProperty('height', '0', 'important');
    hostContainer.style.setProperty('display', 'block', 'important');
    hostContainer.style.setProperty('overflow', 'visible', 'important');
    hostContainer.style.setProperty('border', 'none', 'important');
    hostContainer.style.setProperty('margin', '0', 'important');
    hostContainer.style.setProperty('padding', '0', 'important');
    hostContainer.style.setProperty('transform', 'none', 'important');
    hostContainer.style.setProperty('pointer-events', 'auto', 'important');

    // 2. Attach Shadow DOM (Open Mode) for complete style encapsulation
    const shadowRoot = hostContainer.attachShadow({ mode: 'open' });

    // 3. Inject Tailwind CSS string compiled via Vite ?inline
    const styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    styleElement.setAttribute('data-origin', 'dropguard-tailwind-inline');
    styleElement.textContent = cssText;
    shadowRoot.appendChild(styleElement);

    // 4. Create internal mount point for React
    const reactMount = document.createElement('div');
    reactMount.id = 'dropguard-mount-node';
    shadowRoot.appendChild(reactMount);

    // 5. Append host container directly to root documentElement (bypasses any CSS transforms, filters, perspective, or overflow clipping on document.body)
    const mountTarget = document.documentElement || document.body;
    if (!mountTarget) {
      console.warn('[DropGuard] Target root element not available to mount host container.');
      return;
    }
    mountTarget.appendChild(hostContainer);

    // 6. Mount React 18 Application (clean up previous root if any to prevent memory leaks)
    if (currentReactRoot) {
      try {
        currentReactRoot.unmount();
      } catch (err) {
        console.warn('[DropGuard] Error unmounting previous React root:', err);
      }
      currentReactRoot = null;
    }

    const reactRoot = ReactDOM.createRoot(reactMount);
    currentReactRoot = reactRoot;
    reactRoot.render(
      <React.StrictMode>
        <DropGuardApp detectionResult={detection} deviceId={deviceId} defaultOpen={currentAutoOpen} />
      </React.StrictMode>
    );

    console.log('[DropGuard] Successfully mounted within Shadow DOM root.');
  } finally {
    isInitializing = false;
    // Process any queued manual toolbar open requests that arrived during DOM mounting
    if (pendingForceMount || pendingAutoOpen) {
      const nextForce = pendingForceMount;
      const nextOpen = pendingAutoOpen;
      pendingForceMount = false;
      pendingAutoOpen = false;
      initializeDropGuard(nextForce, nextOpen);
    }
  }
}

// Top-level message listener so toolbar icon click always works even on non-Shopify or late-loading sites
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg: any, _sender: any, sendResponse: any) => {
    if (msg?.action === 'TOGGLE_DRAWER') {
      if (externalToggleDrawer) {
        externalToggleDrawer();
      } else {
        // Mount on-demand with drawer open
        initializeDropGuard(true, true);
      }
      sendResponse?.({ status: 'ok' });
    }
  });
}

// Ensure execution when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeDropGuard(false, false), { once: true });
} else {
  initializeDropGuard(false, false);
}
