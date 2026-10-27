import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, ShieldAlert, RefreshCw, Zap } from 'lucide-react';
import { resetDevQuota, getPricingUrl } from '../services/api';
import { Language, translations } from '../i18n';
import { BUILD_API_BASE_URL } from '../config';

interface PaywallViewProps {
  deviceId: string;
  upgradeUrl?: string;
  onQuotaReset?: () => void;
  resetAt?: string;
  lang?: Language;
}

export const PaywallView: React.FC<PaywallViewProps> = ({ deviceId, upgradeUrl, onQuotaReset, resetAt, lang = 'en' }) => {
  const isDev = Boolean(import.meta.env?.DEV);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const t = translations[lang];
  const [resolvedUrl, setResolvedUrl] = useState(
    upgradeUrl || `${BUILD_API_BASE_URL}/pricing?deviceId=${encodeURIComponent(deviceId)}&ref=paywall_plugin&lang=${lang}`
  );

  useEffect(() => {
    if (upgradeUrl) {
      setResolvedUrl(upgradeUrl);
    } else {
      getPricingUrl(deviceId, 'paywall_plugin').then((url) => {
        const separator = url.includes('?') ? '&' : '?';
        setResolvedUrl(`${url}${separator}lang=${lang}`);
      });
    }
  }, [deviceId, upgradeUrl, lang]);

  const handleDevReset = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      const success = await resetDevQuota(deviceId);
      if (success) {
        setResetMessage(t.paywall.resetSuccess);
        setTimeout(() => {
          setIsResetting(false);
          onQuotaReset?.();
        }, 400);
      } else {
        setIsResetting(false);
        setResetMessage(t.paywall.resetDevOnly);
      }
    } catch {
      setIsResetting(false);
      setResetMessage(t.paywall.resetDevOnly);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950/98 p-6 shadow-2xl backdrop-blur-xl">
      {/* Blurred background mockup elements indicating locked value */}
      <div className="pointer-events-none absolute inset-0 select-none opacity-20 filter blur-[5px]">
        <div className="space-y-3 p-4">
          <div className="h-6 w-3/4 rounded bg-red-500/40" />
          <div className="h-4 w-1/2 rounded bg-slate-400" />
          <div className="h-16 w-full rounded bg-slate-800" />
          <div className="h-20 w-full rounded bg-slate-850" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Animated Lock Shield Badge */}
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/10">
          <Lock className="h-7 w-7 animate-bounce" style={{ animationDuration: '2.5s' }} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-rose-500" />
          </span>
        </div>

        {/* High Conversion Header */}
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
          <ShieldAlert className="h-3 w-3 text-amber-400" />
          {t.paywall.quotaUsed(3, 3)}
        </span>

        <h3 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl leading-snug">
          {t.paywall.headline}
        </h3>

        <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-slate-300">
          {t.paywall.desc}
        </p>

        {/* Feature Highlights Grid */}
        <div className="mt-4 w-full rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-left text-xs">
          <ul className="space-y-2 text-slate-200">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.paywall.f1}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.paywall.f2}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.paywall.f3}</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{t.paywall.f4}</span>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <div className="mt-5 w-full space-y-2.5">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-orange-500/40 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <Zap className="h-4 w-4 fill-current text-amber-100" />
            <span className="text-sm font-bold tracking-wide">{t.paywall.upgradeBtn}</span>
          </a>

          {/* Development / Testing Reset Button */}
          {isDev && (
            <button
              onClick={handleDevReset}
              disabled={isResetting}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isResetting ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isResetting ? '...' : t.paywall.devReset}</span>
            </button>
          )}

          {resetMessage && (
            <p className="text-[10px] text-amber-300/90 animate-fadeIn">
              {resetMessage}
            </p>
          )}

          <p className="text-[10px] text-slate-400">
            {resetAt ? t.paywall.resetAtNotice(new Date(resetAt).toLocaleTimeString()) : t.paywall.resetMidnightNotice}
          </p>
        </div>
      </div>
    </div>
  );
};
