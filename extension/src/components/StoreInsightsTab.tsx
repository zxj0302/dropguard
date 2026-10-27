import React, { useEffect, useState } from 'react';
import { LayoutTemplate, Package, DollarSign, ExternalLink, ShieldAlert, Sparkles, RefreshCw, ShoppingCart, Store } from 'lucide-react';
import { scrapePublicCatalog, StoreCatalogSummary } from '../services/shopifyScraper';
import { Language, translations } from '../i18n';

interface StoreInsightsTabProps {
  onSelectProductForRadar: (productTitle: string, price?: number, imageUrl?: string) => void;
  onSelectProductForSourcing: (productTitle: string, price?: number, imageUrl?: string) => void;
  isShopify?: boolean;
  lang?: Language;
}

export const StoreInsightsTab: React.FC<StoreInsightsTabProps> = ({
  onSelectProductForRadar,
  onSelectProductForSourcing,
  isShopify = true,
  lang = 'en',
}) => {
  const [loading, setLoading] = useState(isShopify);
  const [catalog, setCatalog] = useState<StoreCatalogSummary | null>(null);
  const t = translations[lang];

  const loadData = async () => {
    if (!isShopify) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await scrapePublicCatalog();
      setCatalog(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isShopify) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isShopify]);

  if (!isShopify) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center font-sans space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-sm">
          <Store className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-200">{t.storeInsights.nonShopifyNotice}</h3>
          <p className="text-xs text-slate-400 max-w-[320px] leading-relaxed">
            {t.storeInsights.nonShopifyDesc}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/60" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/60" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-800/60" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-14 animate-pulse rounded-xl bg-slate-800/50" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-800/50" />
          <div className="h-14 animate-pulse rounded-xl bg-slate-800/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-100">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <LayoutTemplate className="h-3.5 w-3.5 text-cyan-400" />
            <span>{t.storeInsights.themeDetected}</span>
          </div>
          <span className="mt-1.5 truncate text-xs font-bold text-slate-100" title={catalog?.themeName}>
            {catalog?.themeName || 'Shopify Theme'}
          </span>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Package className="h-3.5 w-3.5 text-indigo-400" />
            <span>{t.storeInsights.catalogEstimate}</span>
          </div>
          <span className="mt-1.5 text-xs font-bold text-slate-100">
            {catalog && catalog.estimatedCatalogSize >= 30 ? '~30+ Listed' : `~${catalog?.estimatedCatalogSize || 0} Listed`}
          </span>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t.storeInsights.currency}</span>
          </div>
          <span className="mt-1.5 text-xs font-bold text-slate-100">
            {catalog?.currency || 'USD'}
          </span>
        </div>
      </div>

      {/* Freshly Dropped Products Section */}
      <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h4 className="text-xs font-bold tracking-wide text-slate-200">
              {t.storeInsights.latestDrops} ({catalog?.newestProducts.length || 0})
            </h4>
          </div>
          <button
            onClick={loadData}
            title="Refresh Catalog Feed"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {catalog?.newestProducts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            {t.storeInsights.emptyCatalog}
          </div>
        ) : (
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {catalog?.newestProducts.slice(0, 15).map((prod) => (
              <div
                key={prod.id}
                className="group flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700 hover:bg-slate-900/80"
              >
                {/* Thumbnail */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-800 bg-slate-900">
                  {prod.imageUrl ? (
                    <img src={prod.imageUrl} alt={prod.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                      IMG
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <a
                    href={prod.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-slate-200 hover:text-cyan-400 hover:underline"
                  >
                    <span className="truncate">{prod.title}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                  </a>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-semibold text-emerald-400">{prod.price}</span>
                    <span>•</span>
                    <span className="truncate">{prod.vendor}</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const numPrice = prod.rawPrice ?? (!isNaN(parseFloat(prod.price.replace(/[^0-9.]/g, ''))) ? parseFloat(prod.price.replace(/[^0-9.]/g, '')) : undefined);
                      onSelectProductForRadar(prod.title, numPrice, prod.imageUrl);
                    }}
                    title={t.storeInsights.checkIp}
                    className="flex h-7 items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/25"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    <span>IP</span>
                  </button>

                  <button
                    onClick={() => {
                      const numPrice = prod.rawPrice ?? (!isNaN(parseFloat(prod.price.replace(/[^0-9.]/g, ''))) ? parseFloat(prod.price.replace(/[^0-9.]/g, '')) : undefined);
                      onSelectProductForSourcing(prod.title, numPrice, prod.imageUrl);
                    }}
                    title={t.storeInsights.checkSourcing}
                    className="flex h-7 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/25"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    <span>Supply</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
