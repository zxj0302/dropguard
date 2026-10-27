import React, { useState } from 'react';
import { ShieldAlert, Radar, ChevronRight, Sparkles } from 'lucide-react';
import { Language, translations } from '../i18n';

interface FloatingButtonProps {
  onToggleDrawer?: () => void;
  isOpen?: boolean;
  detectedCount?: number;
  isShopify?: boolean;
  lang?: Language;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  onToggleDrawer,
  isOpen = false,
  detectedCount = 0,
  isShopify = true,
  lang = 'en',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const t = translations[lang];

  return (
    <div
      className={`fixed bottom-6 right-6 z-[2147483645] select-none font-sans antialiased transition-all duration-300 ${
        isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 pointer-events-auto scale-100'
      }`}
    >
      <button
        onClick={onToggleDrawer}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-white shadow-2xl transition-all duration-300 ease-out active:scale-95 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-black/40 hover:border-cyan-500/50 hover:shadow-cyan-500/25"
        style={{
          boxShadow: isHovered
            ? '0 12px 30px -4px rgba(6, 182, 212, 0.3), 0 4px 12px -2px rgba(0, 0, 0, 0.4)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
        aria-label={t.floatingButton.ariaLabel}
      >
        {/* Glow backdrop aura */}
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-20 blur-sm transition duration-300 group-hover:opacity-60" />

        <div className="relative flex items-center gap-2">
          {/* Main Shield Icon with Pulse Radar Dot */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-inner">
            <ShieldAlert className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>

          {/* Label & Shopify Detected Badge */}
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wider text-slate-100 uppercase">
                DropGuard
              </span>
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-tight text-cyan-300 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Radar className="h-2.5 w-2.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-emerald-400">{isShopify ? t.floatingButton.liveShopify : t.floatingButton.liveGeneric}</span>
              {detectedCount > 0 && (
                <span className="text-amber-400 font-semibold">{t.floatingButton.risksDetected(detectedCount)}</span>
              )}
            </div>
          </div>

          {/* Action indicator icon */}
          <div className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 transition-colors duration-200 group-hover:bg-cyan-500/20 group-hover:text-cyan-300">
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-300 ${
                isOpen ? 'rotate-90' : 'group-hover:translate-x-0.5'
              }`}
            />
          </div>
        </div>

        {/* Hover quick tip tooltip */}
        {isHovered && !isOpen && (
          <div className="absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-xl backdrop-blur-md transition-all">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>{t.floatingButton.tooltip}</span>
            </div>
            <div className="absolute -bottom-1 right-6 h-2 w-2 rotate-45 border-b border-r border-slate-700/80 bg-slate-900" />
          </div>
        )}
      </button>
    </div>
  );
};

