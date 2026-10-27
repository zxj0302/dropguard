import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Search,
  ExternalLink,
  AlertCircle,
  Factory,
  Globe2,
  X,
} from 'lucide-react';
import { runSourceFinder, SourceFinderResult, QuotaExceededError, QuotaInfo } from '../services/api';
import { PaywallView } from './PaywallView';
import { Language, translations } from '../i18n';
import { formatCurrencyPrice } from '../services/shopifyScraper';

interface SupplySourcingTabProps {
  deviceId: string;
  initialTitle?: string;
  initialPrice?: number;
  initialCurrency?: string;
  initialImage?: string;
  quota?: QuotaInfo;
  upgradeUrl?: string;
  autoRunTrigger?: number;
  onQuotaUpdate: (quota: QuotaInfo) => void;
  lang?: Language;
}

export const SupplySourcingTab: React.FC<SupplySourcingTabProps> = ({
  deviceId,
  initialTitle = '',
  initialPrice,
  initialCurrency,
  initialImage,
  quota,
  upgradeUrl,
  autoRunTrigger,
  onQuotaUpdate,
  lang = 'en',
}) => {
  const [title, setTitle] = useState(initialTitle);
  // No fabricated default price: when the page price could not be scraped the user must enter one
  const isValidPrice = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1_000_000;
  const [price, setPrice] = useState<number | undefined>(isValidPrice(initialPrice) ? initialPrice : undefined);
  const [priceInput, setPriceInput] = useState(isValidPrice(initialPrice) ? String(initialPrice) : '');
  const currency = (initialCurrency || 'USD').toUpperCase();
  const fmt = (n: number) => formatCurrencyPrice(n, currency);
  // Monotonic request id: results from superseded requests (e.g. user switched product) are discarded
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);
  const [activeImage, setActiveImage] = useState<string | undefined>(initialImage);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SourceFinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const t = translations[lang];

  // Auto-dismiss paywall when user upgrades to Pro or quota replenishes
  useEffect(() => {
    if (quota && (quota.isPro || quota.remaining > 0)) {
      setIsQuotaExceeded(false);
    }
  }, [quota]);

  const handleRunSourcing = async (titleToRun?: string, priceToRun?: number, imageToRun?: string) => {
    if (loadingRef.current) return;
    const targetTitle = (titleToRun || title).trim();
    if (!targetTitle) return;

    const candidatePrice = typeof priceToRun === 'number' ? priceToRun : price;
    if (!isValidPrice(candidatePrice)) {
      // Block the request (and quota consumption) when no valid positive price is available
      setError(t.supplySourcing.priceRequired);
      return;
    }
    const targetPrice = candidatePrice;

    // Check if the title diverged from the initial product title
    const isTitleDiverged = targetTitle !== (initialTitle || '').trim();
    const candidateImage = imageToRun !== undefined ? imageToRun : activeImage;
    // Invalidate stale image association if title was manually changed
    const finalImage = isTitleDiverged ? undefined : candidateImage;

    if (isTitleDiverged && activeImage) {
      setActiveImage(undefined);
    }

    const seq = ++requestSeq.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setIsQuotaExceeded(false);

    try {
      const res = await runSourceFinder(targetTitle, deviceId, targetPrice, finalImage, currency);
      if (seq !== requestSeq.current) return; // stale response: product changed meanwhile
      setResult(res.data);
      onQuotaUpdate(res.quota);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      if (err instanceof QuotaExceededError) {
        setIsQuotaExceeded(true);
        onQuotaUpdate(err.quotaInfo);
      } else {
        setError(err?.message || 'Failed to estimate supply margins. Please try again.');
      }
    } finally {
      if (seq === requestSeq.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  };

  // Sync inputs from props without burning free quota
  useEffect(() => {
    if (initialTitle && initialTitle.trim()) {
      setTitle(initialTitle);
      setActiveImage(initialImage);
      // Never invent a price: leave empty (user must type one) when the page price is unknown
      setPrice(isValidPrice(initialPrice) ? initialPrice : undefined);
      setPriceInput(isValidPrice(initialPrice) ? String(initialPrice) : '');
      setResult(null);
      setError(null);
    } else {
      setTitle('');
      setActiveImage(undefined);
      setResult(null);
      setError(null);
    }
    // Invalidate any in-flight request tied to the previous product
    requestSeq.current++;
    loadingRef.current = false;
    setLoading(false);
  }, [initialTitle, initialPrice, initialImage]);

  // Auto run sourcing trigger
  useEffect(() => {
    if (autoRunTrigger && autoRunTrigger > 0 && initialTitle && initialTitle.trim()) {
      handleRunSourcing(initialTitle, initialPrice, initialImage);
    }
  }, [autoRunTrigger]);

  if (isQuotaExceeded) {
    return (
      <PaywallView
        deviceId={deviceId}
        upgradeUrl={upgradeUrl}
        resetAt={quota?.resetAt}
        lang={lang}
        onQuotaReset={() => {
          setIsQuotaExceeded(false);
          handleRunSourcing();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Parameter Controls */}
      <div className="space-y-3 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-3.5">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            {t.supplySourcing.inputLabel}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              const newTitle = e.target.value;
              setTitle(newTitle);
              // Clean expired image association when user manually modifies the title
              if (newTitle.trim() !== (initialTitle || '').trim() && activeImage) {
                setActiveImage(undefined);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) handleRunSourcing();
            }}
            placeholder={t.supplySourcing.inputPlaceholder}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2 px-3 text-xs text-white placeholder-slate-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />

          {/* Associated Product Image Indicator with Clear Button */}
          {activeImage && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/70 px-2.5 py-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-2 truncate">
                <img
                  src={activeImage}
                  alt="Product preview"
                  className="h-6 w-6 rounded border border-slate-700 object-cover shrink-0"
                />
                <span className="truncate text-slate-400">{t.supplySourcing.associatedImg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveImage(undefined)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-rose-400"
                title={t.supplySourcing.clearImg}
              >
                <X className="h-3 w-3" />
                <span>{t.supplySourcing.clearImg}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {t.supplySourcing.priceLabel}
            </label>
            <div className="relative">
              <span className="absolute left-2 top-2 text-[10px] text-slate-400">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={priceInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setPriceInput(val);
                  const parsed = parseFloat(val);
                  if (Number.isFinite(parsed) && parsed > 0) {
                    setPrice(Math.min(parsed, 1_000_000));
                  } else {
                    setPrice(undefined);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) handleRunSourcing();
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2 pl-11 pr-3 text-xs text-white placeholder-slate-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          <button
            onClick={() => handleRunSourcing()}
            disabled={loading || !title.trim()}
            className="mt-5 flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                {t.supplySourcing.sourcing}
              </span>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                <span>{t.supplySourcing.sourceBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Shimmer Skeleton */}
      {loading && (
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-800" />
          </div>
          <div className="h-24 animate-pulse rounded-xl bg-slate-800/60" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
        </div>
      )}

      {/* Sourcing Intelligence Result */}
      {result && !loading && (
        <div className="space-y-3.5">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Ex-works Factory Bracket */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Factory className="h-3.5 w-3.5 text-cyan-400" />
                <span>{t.supplySourcing.estExWorks}</span>
              </div>
              <div className="mt-2 text-base font-black text-cyan-300">
                {fmt(result.profit_estimate.estimated_factory_cost_min)} - {fmt(result.profit_estimate.estimated_factory_cost_max)}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">
                ~18%-28% of Retail
              </p>
            </div>

            {/* Breakeven Ad CPA Ceiling */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t.supplySourcing.breakevenCpa}</span>
              </div>
              <div className="mt-2 text-base font-black text-emerald-400">
                {fmt(result.dropship_insights.suggested_ad_spend_cap)}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">Max ROAS Threshold</p>
            </div>
          </div>

          {/* Unit Economics Breakdown Card */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5 text-xs">
            <h4 className="font-semibold text-slate-300 mb-2 flex items-center justify-between">
              <span>{t.supplySourcing.grossMargin}</span>
              <span className="font-mono text-emerald-400 font-bold">
                {fmt(result.profit_estimate.estimated_gross_profit)} ({result.profit_estimate.estimated_gross_margin_percentage.toFixed(0)}%)
              </span>
            </h4>

            <div className="space-y-1.5 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Retail Price</span>
                <span className="font-mono text-slate-200">{fmt(result.profit_estimate.retail_price)}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. International Packet ePacket/Air Shipping</span>
                <span className="font-mono text-slate-200">
                  {fmt(result.profit_estimate.estimated_shipping_cost)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Typical Dispatch SLA</span>
                <span className="font-mono text-cyan-300">
                  {result.dropship_insights.typical_dispatch_time}
                </span>
              </div>
            </div>
          </div>

          {/* Deep Links to Sourcing Platforms */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>{t.supplySourcing.directSourceLinks}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={result.direct_sourcing_links.alibaba1688}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">
                    1688
                  </span>
                  <span>{t.supplySourcing.link1688}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>

              <a
                href={result.direct_sourcing_links.aliexpress}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-500/20 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500 text-white font-black text-[10px]">
                    Ali
                  </span>
                  <span>{t.supplySourcing.linkAliExpress}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>

              <a
                href={result.direct_sourcing_links.taobao}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/10 p-2.5 text-xs font-semibold text-orange-300 transition-all hover:bg-orange-500/20 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-white font-black text-[10px]">
                    TB
                  </span>
                  <span>{t.supplySourcing.linkTaobao}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>

              {result.direct_sourcing_links.google_lens ? (
                <a
                  href={result.direct_sourcing_links.google_lens}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs font-semibold text-blue-300 transition-all hover:bg-blue-500/20 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white font-black text-[10px]">
                      Lens
                    </span>
                    <span className="truncate">{t.supplySourcing.linkGoogleLens}</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
                </a>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-2.5 text-xs text-slate-400">
                  <span className="text-[11px]">No image for visual search</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 leading-normal">
            {t.supplySourcing.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};
