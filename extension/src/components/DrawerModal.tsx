import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldAlert,
  Store,
  DollarSign,
  Radar,
  Sparkles,
  Zap,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import { StoreInsightsTab } from './StoreInsightsTab';
import { IpRadarTab } from './IpRadarTab';
import { SupplySourcingTab } from './SupplySourcingTab';
import { scrapeActiveProduct } from '../services/shopifyScraper';
import { fetchQuotaStatus, getPricingUrl, QuotaInfo } from '../services/api';
import { BUILD_API_BASE_URL } from '../config';
import { Language, getDefaultLanguage, STORAGE_LANG_KEY, translations } from '../i18n';

interface DrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  isShopify?: boolean;
  onDetectedCountChange?: (count: number) => void;
  lang?: Language;
  onLangChange?: (lang: Language) => void;
}

type TabType = 'insights' | 'radar' | 'sourcing';

export const DrawerModal: React.FC<DrawerModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  isShopify = true,
  onDetectedCountChange,
  lang: propLang,
  onLangChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('insights');
  const [lang, setLang] = useState<Language>(propLang || getDefaultLanguage());

  useEffect(() => {
    if (propLang && propLang !== lang) {
      setLang(propLang);
    }
  }, [propLang]);

  // Load language preference from storage
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

  const handleToggleLang = () => {
    const nextLang: Language = lang === 'zh' ? 'en' : 'zh';
    setLang(nextLang);
    onLangChange?.(nextLang);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_LANG_KEY]: nextLang }).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const t = translations[lang];

  // Selected item state passed between tabs
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(undefined);
  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>(undefined);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const isProductLockedRef = useRef(false);
  const [autoRunScanTrigger, setAutoRunScanTrigger] = useState(0);
  const [autoRunSourcingTrigger, setAutoRunSourcingTrigger] = useState(0);
  const [bottomUpgradeUrl, setBottomUpgradeUrl] = useState('');
  const [radarUpgradeUrl, setRadarUpgradeUrl] = useState('');
  const [sourcingUpgradeUrl, setSourcingUpgradeUrl] = useState('');
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);

  const handleCopyDeviceId = async () => {
    if (!deviceId) return;
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = deviceId;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedDeviceId(true);
        setTimeout(() => setCopiedDeviceId(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  // Quota status
  const [quota, setQuota] = useState<QuotaInfo>({
    limit: 3,
    remaining: 3,
    isExceeded: false,
  });

  useEffect(() => {
    getPricingUrl(deviceId, 'bottom_bar').then((url) => setBottomUpgradeUrl(url));
    getPricingUrl(deviceId, 'paywall_radar').then((url) => setRadarUpgradeUrl(url));
    getPricingUrl(deviceId, 'paywall_sourcing').then((url) => setSourcingUpgradeUrl(url));
  }, [deviceId]);

  // Handle ESC key to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const refreshStatus = () => {
      fetchQuotaStatus(deviceId)
        .then((data) => {
          setQuota(data);
        })
        .catch(() => {});
    };

    const checkProduct = () => {
      const pageProd = scrapeActiveProduct();
      if (pageProd.isProductPage && pageProd.title) {
        isProductLockedRef.current = false;
        setSelectedTitle(pageProd.title);
        setSelectedPrice(pageProd.price);
        setSelectedCurrency(pageProd.currency);
        setSelectedImage(pageProd.imageUrl);
      } else if (!pageProd.isProductPage && !isProductLockedRef.current) {
        setSelectedTitle('');
        setSelectedPrice(undefined);
        setSelectedImage(undefined);
      }
    };

    refreshStatus();
    checkProduct();

    const handleFocus = () => refreshStatus();
    const handleLocationChange = () => checkProduct();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('locationchange', handleLocationChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, [isOpen, deviceId]);

  const handleSelectProductForRadar = (title: string, price?: number, imageUrl?: string) => {
    isProductLockedRef.current = true;
    setSelectedTitle(title);
    setSelectedPrice(price);
    setSelectedImage(imageUrl);
    setActiveTab('radar');
    setAutoRunScanTrigger((prev) => prev + 1);
  };

  const handleSelectProductForSourcing = (title: string, price?: number, imageUrl?: string) => {
    isProductLockedRef.current = true;
    setSelectedTitle(title);
    setSelectedPrice(price);
    setSelectedImage(imageUrl);
    setActiveTab('sourcing');
    setAutoRunSourcingTrigger((prev) => prev + 1);
  };

  return (
    <div
      className={`fixed inset-0 z-[2147483646] flex items-end justify-end p-4 sm:p-6 font-sans antialiased transition-all duration-300 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Click-outside backdrop overlay to seamlessly dismiss drawer */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Close DropGuard Drawer"
      />

      {/* Raycast-style Drawer Container */}
      <div
        className={`relative z-10 flex h-[min(620px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl ring-1 ring-cyan-500/20 transition-all duration-300 ease-out transform ${
          isOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px -5px rgba(6, 182, 212, 0.15)',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-sm">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-white">
                  {t.global.appName}
                </span>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-cyan-300 border border-cyan-500/30">
                  {t.global.proBadge}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Shopify Intelligence & IP Defense
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Free or Pro Quota Indicator Pill */}
            {quota.isPro ? (
              <div className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-sm shadow-cyan-500/20">
                <Sparkles className="h-2.5 w-2.5 text-cyan-300" />
                <span>{t.global.proUnlimited}</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  quota.remaining > 0
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <Zap className="h-2.5 w-2.5" />
                <span>{t.global.freeQuota(quota.remaining, quota.limit)}</span>
              </div>
            )}

            {/* Language Toggle Button */}
            <button
              onClick={handleToggleLang}
              title={lang === 'zh' ? 'Switch to English' : '切换为简体中文'}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-sm"
            >
              <Globe className="h-3 w-3 text-cyan-400" />
              <span>{t.global.langToggle}</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-slate-900/40 p-1">
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'insights'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="h-3.5 w-3.5 text-cyan-400" />
            <span>{t.global.tabs.insights}</span>
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'radar'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radar className="h-3.5 w-3.5 text-rose-400" />
            <span>{t.global.tabs.radar}</span>
          </button>

          <button
            onClick={() => setActiveTab('sourcing')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'sourcing'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t.global.tabs.sourcing}</span>
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
            <StoreInsightsTab
              onSelectProductForRadar={handleSelectProductForRadar}
              onSelectProductForSourcing={handleSelectProductForSourcing}
              isShopify={isShopify}
              lang={lang}
            />
          </div>

          <div className={activeTab === 'radar' ? 'block' : 'hidden'}>
            <IpRadarTab
              deviceId={deviceId}
              initialTitle={selectedTitle}
              initialImage={selectedImage}
              quota={quota}
              upgradeUrl={radarUpgradeUrl}
              autoRunTrigger={autoRunScanTrigger}
              onQuotaUpdate={(newQuota) => setQuota(newQuota)}
              onDetectedCountChange={onDetectedCountChange}
              lang={lang}
            />
          </div>

          <div className={activeTab === 'sourcing' ? 'block' : 'hidden'}>
            <SupplySourcingTab
              deviceId={deviceId}
              initialTitle={selectedTitle}
              initialPrice={selectedPrice}
              initialCurrency={selectedCurrency}
              initialImage={selectedImage}
              quota={quota}
              upgradeUrl={sourcingUpgradeUrl}
              autoRunTrigger={autoRunSourcingTrigger}
              onQuotaUpdate={(newQuota) => setQuota(newQuota)}
              lang={lang}
            />
          </div>
        </div>

        {/* Bottom Utility Bar with click-to-copy Device ID */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/60 px-4 py-2 text-[10px] text-slate-400">
          <button
            onClick={handleCopyDeviceId}
            type="button"
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-slate-800/80 hover:text-slate-200 group max-w-[210px]"
            title={`${t.global.copyTooltip}: ${deviceId}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate font-mono">{t.global.deviceId} {deviceId.slice(0, 12)}...</span>
            {copiedDeviceId ? (
              <span className="flex items-center gap-0.5 text-emerald-400 font-semibold text-[9px] animate-pulse">
                <Check className="h-2.5 w-2.5" />
                <span>{t.global.copiedDeviceId}</span>
              </span>
            ) : (
              <Copy className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {quota.isPro ? (
            <div className="flex items-center gap-1 font-semibold text-emerald-400">
              <Sparkles className="h-3 w-3" />
              <span>{t.global.proUnlimited}</span>
            </div>
          ) : (
            <a
              href={bottomUpgradeUrl || `${BUILD_API_BASE_URL}/pricing?deviceId=${encodeURIComponent(deviceId)}&ref=bottom_bar&lang=${lang}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-semibold text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
            >
              <Sparkles className="h-3 w-3" />
              <span>{t.global.upgradePro}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
