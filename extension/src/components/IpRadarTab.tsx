import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Search, Building2 } from 'lucide-react';
import { runIpCheck, IpCheckResult, QuotaExceededError, QuotaInfo } from '../services/api';
import { PaywallView } from './PaywallView';
import { Language, translations } from '../i18n';

interface IpRadarTabProps {
  deviceId: string;
  initialTitle?: string;
  initialImage?: string;
  quota?: QuotaInfo;
  upgradeUrl?: string;
  autoRunTrigger?: number;
  onQuotaUpdate: (quota: QuotaInfo) => void;
  onDetectedCountChange?: (count: number) => void;
  lang?: Language;
}

export const IpRadarTab: React.FC<IpRadarTabProps> = ({
  deviceId,
  initialTitle = '',
  initialImage,
  quota,
  upgradeUrl,
  autoRunTrigger,
  onQuotaUpdate,
  onDetectedCountChange,
  lang = 'en',
}) => {
  const [productTitle, setProductTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IpCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const t = translations[lang];
  // Monotonic request id: results from superseded requests (e.g. user switched product) are discarded
  const requestSeq = useRef(0);
  const loadingRef = useRef(false);

  // Auto-dismiss paywall when user upgrades to Pro or quota replenishes
  useEffect(() => {
    if (quota && (quota.isPro || quota.remaining > 0)) {
      setIsQuotaExceeded(false);
    }
  }, [quota]);

  // Sync title from props to input box without burning free quota and reset floating ball risk count
  useEffect(() => {
    if (initialTitle && initialTitle.trim()) {
      setProductTitle(initialTitle);
      setResult(null);
      setError(null);
      onDetectedCountChange?.(0);
    } else {
      setProductTitle('');
      setResult(null);
      setError(null);
      onDetectedCountChange?.(0);
    }
    // Invalidate any in-flight scan tied to the previous product
    requestSeq.current++;
    loadingRef.current = false;
    setLoading(false);
  }, [initialTitle]);

  // Auto run scan trigger
  useEffect(() => {
    if (autoRunTrigger && autoRunTrigger > 0 && initialTitle && initialTitle.trim()) {
      handleRunScan(initialTitle);
    }
  }, [autoRunTrigger]);

  const handleRunScan = async (titleToScan?: string) => {
    if (loadingRef.current) return;
    const targetTitle = (titleToScan || productTitle).trim();
    if (!targetTitle) return;

    // Monotonic request id: results of superseded requests (product switched meanwhile) are discarded
    const seq = ++requestSeq.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setIsQuotaExceeded(false);

    try {
      const res = await runIpCheck(targetTitle, deviceId, initialImage);
      if (seq !== requestSeq.current) return;
      setResult(res.data);
      onQuotaUpdate(res.quota);
      onDetectedCountChange?.(res.data.detected_terms?.length || 0);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      if (err instanceof QuotaExceededError) {
        setIsQuotaExceeded(true);
        onQuotaUpdate(err.quotaInfo);
      } else {
        setError(err?.message || 'Failed to scan IP radar. Please try again.');
      }
    } finally {
      if (seq === requestSeq.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  };

  // Render Paywall overlay if daily quota is consumed
  if (isQuotaExceeded) {
    return (
      <PaywallView
        deviceId={deviceId}
        upgradeUrl={upgradeUrl}
        resetAt={quota?.resetAt}
        lang={lang}
        onQuotaReset={() => {
          setIsQuotaExceeded(false);
          handleRunScan();
        }}
      />
    );
  }

  const getRiskLabel = () => {
    if (!result) return '';
    if (result.risk_level === 'DANGER') return t.ipRadar.riskDanger;
    if (result.risk_level === 'WARNING') return t.ipRadar.riskWarning;
    return t.ipRadar.riskSafe;
  };

  const getSummaryText = () => {
    if (!result) return '';
    if (lang === 'zh') {
      if (result.risk_level === 'DANGER') return t.ipRadar.dangerSummary(result.detected_terms?.length || 0);
      if (result.risk_level === 'WARNING') return t.ipRadar.warningSummary(result.detected_terms?.length || 0);
      return t.ipRadar.safeSummary;
    }
    return result.summary || t.ipRadar.safeSummary;
  };

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Title Input & Action */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          {t.ipRadar.inputLabel}
        </label>
        <div className="relative">
          <input
            type="text"
            value={productTitle}
            onChange={(e) => setProductTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) handleRunScan();
            }}
            placeholder={t.ipRadar.inputPlaceholder}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-3.5 pr-24 text-xs text-white placeholder-slate-400 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <button
            onClick={() => handleRunScan()}
            disabled={loading || !productTitle.trim()}
            className="absolute right-1.5 top-1.5 flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 text-[11px] font-semibold text-white shadow transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                {t.ipRadar.scanning}
              </span>
            ) : (
              <>
                <Search className="h-3 w-3" />
                <span>{t.ipRadar.scanBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => handleRunScan()}
            className="mt-2 text-[10px] underline hover:text-white"
          >
            {t.ipRadar.retry}
          </button>
        </div>
      )}

      {/* Shimmer Skeleton Loading View */}
      {loading && (
        <div className="space-y-3.5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800/60" />
            </div>
          </div>
          <div className="h-16 animate-pulse rounded-xl bg-slate-800/50" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Risk Level & Gauge Meter Card */}
          <div
            className={`relative overflow-hidden rounded-2xl border p-4 shadow-xl transition-all ${
              result.risk_level === 'DANGER'
                ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900'
                : result.risk_level === 'WARNING'
                ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-900'
                : 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900/90 to-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${
                    result.risk_level === 'DANGER'
                      ? 'bg-rose-500 shadow-rose-500/30 ring-4 ring-rose-500/20'
                      : result.risk_level === 'WARNING'
                      ? 'bg-amber-500 shadow-amber-500/30 ring-4 ring-amber-500/20'
                      : 'bg-emerald-500 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                  }`}
                >
                  {result.risk_level === 'DANGER' ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : result.risk_level === 'WARNING' ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <ShieldCheck className="h-6 w-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-black tracking-wide ${
                        result.risk_level === 'DANGER'
                          ? 'text-rose-400'
                          : result.risk_level === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {getRiskLabel()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t.ipRadar.riskScore}: {result.risk_score} / 100
                  </p>
                </div>
              </div>

              {/* Gauge Circle */}
              <div className="relative flex h-14 w-14 items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={
                      result.risk_level === 'DANGER'
                        ? 'text-rose-500'
                        : result.risk_level === 'WARNING'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                    strokeDasharray={`${result.risk_score}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-bold text-white">
                  {result.risk_score}
                </span>
              </div>
            </div>

            {/* Assessment Narrative */}
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {getSummaryText()}
            </p>
          </div>

          {/* Detected Matches List */}
          {result.detected_terms && result.detected_terms.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <span>{t.ipRadar.detectedMatches} ({result.detected_terms.length})</span>
              </div>

              <div className="space-y-2.5">
                {result.detected_terms.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 transition-colors hover:border-slate-700 hover:bg-slate-900/90"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-xs">{item.term}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                              item.lawsuit_risk === 'EXTREME'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : item.lawsuit_risk === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}
                          >
                            {item.lawsuit_risk === 'EXTREME'
                              ? t.ipRadar.extremeLawsuit
                              : item.lawsuit_risk === 'HIGH'
                              ? t.ipRadar.highLawsuit
                              : t.ipRadar.mediumLawsuit}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Building2 className="h-2.5 w-2.5" />
                          <span>{item.owner}</span>
                          <span>•</span>
                          <span>{item.category}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {Math.round(item.similarity * 100)}%
                        </span>
                        <div className="text-[9px] text-slate-400">{t.ipRadar.similarity}</div>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
