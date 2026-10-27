import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const enDir = path.resolve('store_assets/en');
const zhDir = path.resolve('store_assets/zh');
const drawersDir = path.resolve('store_assets/drawers');

function toBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

const squircleIconB64 = toBase64(path.resolve('store_assets/icon_squircle.png'));

const enInsightsDrawerB64 = toBase64(path.join(drawersDir, 'en_drawer_insights.png'));
const enRadarDrawerB64 = toBase64(path.join(drawersDir, 'en_drawer_radar.png'));
const enSourcingDrawerB64 = toBase64(path.join(drawersDir, 'en_drawer_sourcing.png'));

const zhInsightsDrawerB64 = toBase64(path.join(drawersDir, 'zh_drawer_insights.png'));
const zhRadarDrawerB64 = toBase64(path.join(drawersDir, 'zh_drawer_radar.png'));
const zhSourcingDrawerB64 = toBase64(path.join(drawersDir, 'zh_drawer_sourcing.png'));

function getHeroHtml(cfg) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 1280px;
      height: 800px;
      background: radial-gradient(circle at 75% 50%, #152238 0%, #0b1120 50%, #020617 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 44px;
      overflow: hidden;
      position: relative;
    }
    .ambient-glow {
      position: absolute;
      right: 180px;
      top: 100px;
      width: 480px;
      height: 600px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .left-pane {
      width: 610px;
      display: flex;
      flex-direction: column;
      z-index: 2;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      filter: drop-shadow(0 6px 16px rgba(6, 182, 212, 0.4));
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #fff;
    }
    .brand-pill {
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .main-title {
      font-size: 34px;
      font-weight: 900;
      line-height: 1.25;
      letter-spacing: -0.6px;
      margin-bottom: 16px;
      color: #f8fafc;
    }
    .main-title span {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 16px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .features-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .feat-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .feat-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .feat-info h4 {
      font-size: 14px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 2px;
    }
    .feat-info p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .right-pane {
      width: 535px;
      height: 720px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .drawer-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 25px 50px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 25px rgba(6, 182, 212, 0.2));
    }
  </style>
</head>
<body>
  <div class="ambient-glow"></div>
  <div class="left-pane">
    <div class="brand-bar">
      <img class="brand-icon" src="${squircleIconB64}" alt="DropGuard Icon" />
      <span class="brand-title">DropGuard</span>
      <span class="brand-pill">${cfg.pill}</span>
    </div>
    <h1 class="main-title">${cfg.title}</h1>
    <p class="subtitle">${cfg.subtitle}</p>
    <div class="features-list">
      ${cfg.features.map(f => `
        <div class="feat-card">
          <div class="feat-icon-box" style="background: ${f.bg}; color: ${f.color};">
            ${f.icon}
          </div>
          <div class="feat-info">
            <h4>${f.title}</h4>
            <p>${f.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  <div class="right-pane">
    <img class="drawer-img" src="${cfg.drawerB64}" alt="Drawer UI" />
  </div>
</body>
</html>`;
}

const icons = {
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  zap: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  store: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`,
  box: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  dollar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  trending: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  factory: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4L2 20z"/></svg>`,
};

const enScreenshots = [
  {
    pill: 'STORE INSIGHTS',
    title: 'Instant Shopify Theme & <span>Live Catalog Spy</span>',
    subtitle: 'Deep-dive into competitor Shopify storefronts in 1-click. Reveal active themes, listing velocity, and catalog metrics.',
    drawerB64: enInsightsDrawerB64,
    features: [
      {
        icon: icons.store,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: 'Theme & Tech Stack Detection',
        desc: 'Uncovers official & custom themes (Dawn, Prestige, Impulse) instantly.'
      },
      {
        icon: icons.box,
        bg: 'rgba(99, 102, 241, 0.15)',
        color: '#818cf8',
        title: 'Real-Time Catalog Sizing',
        desc: 'Estimates full store catalog size and average retail pricing structure.'
      },
      {
        icon: icons.zap,
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        title: 'Newest Product Drops Stream',
        desc: 'Direct quick-actions to scan trademark IP or source from manufacturers.'
      }
    ],
    out: path.join(enDir, 'screenshot_1_1280x800.png')
  },
  {
    pill: 'LEGAL IP RADAR',
    title: 'Pre-Listing <span>Trademark & TRO Infringement Defense</span>',
    subtitle: 'Eliminate costly federal lawsuits, PayPal/Stripe account freezes, and inventory confiscations before launching products.',
    drawerB64: enRadarDrawerB64,
    features: [
      {
        icon: icons.shield,
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        title: '1,200+ Cross-Border TRO Entity Database',
        desc: 'Aggressive law firms tracked (AMS, Sullivan & Worcester, Keith, GBC).'
      },
      {
        icon: icons.alert,
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        title: 'Threat Index & Risk Scoring (0-100)',
        desc: 'Exact & fuzzy trademark similarity algorithms with risk categorization.'
      },
      {
        icon: icons.zap,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: '1-Click Product Page Analysis',
        desc: 'Scan titles & keywords automatically on any active Shopify product.'
      }
    ],
    out: path.join(enDir, 'screenshot_2_1280x800.png')
  },
  {
    pill: 'SUPPLY SOURCING',
    title: '1688 Factory Sourcing & <span>Profit Margin Finder</span>',
    subtitle: 'Cut out middlemen dropshippers. Uncover original manufacturer ex-works pricing, calculate true margins, and get direct 1688 links.',
    drawerB64: enSourcingDrawerB64,
    features: [
      {
        icon: icons.factory,
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        title: 'Ex-Works Factory Cost Benchmark',
        desc: 'Calculates expected manufacturer base cost (~18%-28% of retail price).'
      },
      {
        icon: icons.trending,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: 'Breakeven Ad CPA Estimator',
        desc: 'Know your exact maximum allowable ad spend cap for Meta & TikTok ads.'
      },
      {
        icon: icons.dollar,
        bg: 'rgba(99, 102, 241, 0.15)',
        color: '#818cf8',
        title: '1-Click Deep Factory Links',
        desc: 'Instant direct search deep links to 1688, Taobao, and AliExpress.'
      }
    ],
    out: path.join(enDir, 'screenshot_3_1280x800.png')
  }
];

const zhScreenshots = [
  {
    pill: '独立站竞品透视',
    title: '一键反查 <span>Shopify 模板与在售全量商品</span>',
    subtitle: '出海卖家必备竞品分析神器。无需翻查网页源码，一键提取对手独立站主题模板、商品总数与上架节奏。',
    drawerB64: zhInsightsDrawerB64,
    features: [
      {
        icon: icons.store,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: '模板与技术栈深度探测',
        desc: '精准识别官方 Dawn、Prestige、Impulse 及各类定制 Shopify 主题。'
      },
      {
        icon: icons.box,
        bg: 'rgba(99, 102, 241, 0.15)',
        color: '#818cf8',
        title: '全店在售规模与客单价估算',
        desc: '自动汇总店铺在售商品规模、定价区间与结算币种分布。'
      },
      {
        icon: icons.zap,
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        title: '最新上架新品实时监控流',
        desc: '实时抓取竞品爆款新品，支持一键排查侵权与一键反查 1688 货源。'
      }
    ],
    out: path.join(zhDir, 'screenshot_1_1280x800.png')
  },
  {
    pill: '跨国侵权雷达',
    title: '上架前精准排查 <span>TRO 侵权诉讼高危词与品牌</span>',
    subtitle: '彻底告别美国联邦法院 TRO 诉讼、PayPal/Stripe 资金冻结与店铺封号。上架前一秒扫描，防患于未然。',
    drawerB64: zhRadarDrawerB64,
    features: [
      {
        icon: icons.shield,
        bg: 'rgba(239, 68, 68, 0.15)',
        color: '#f87171',
        title: '1,200+ 跨国高危 TRO 诉讼品牌库',
        desc: '覆盖 AMS、Keith、GBC、Sullivan 等律所重点跨国维权品牌。'
      },
      {
        icon: icons.alert,
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        title: '威胁指数量化与风险定级 (0-100)',
        desc: '多维度排查注册商标、外观专利、动漫 IP 与高危品牌词。'
      },
      {
        icon: icons.zap,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: '独立站详情页一键无感扫描',
        desc: '自动提取当前浏览商品的标题与关键词，无需手动复制粘贴。'
      }
    ],
    out: path.join(zhDir, 'screenshot_2_1280x800.png')
  },
  {
    pill: '源头货源挖掘',
    title: '1688 源头工厂直达反查 & <span>真实毛利空间测算</span>',
    subtitle: '剔除海外中间商差价。直接对标国内 1688 原厂出厂价，自动测算广告保本 CPA 阈值与净利润。',
    drawerB64: zhSourcingDrawerB64,
    features: [
      {
        icon: icons.factory,
        bg: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        title: '原厂出厂底价测算基准',
        desc: '根据类目模型精准评估工厂出厂成本（通常为售价 18%~28%）。'
      },
      {
        icon: icons.trending,
        bg: 'rgba(6, 182, 212, 0.15)',
        color: '#38bdf8',
        title: 'Meta / TikTok 广告保本 CPA 测算',
        desc: '测算可承受最高获客成本与保本 ROAS，避免盲目投放亏损。'
      },
      {
        icon: icons.dollar,
        bg: 'rgba(99, 102, 241, 0.15)',
        color: '#818cf8',
        title: '一键直达 1688 / 淘宝同款工厂',
        desc: '自动生成去噪关键词与以图搜款直达链接，无缝对齐采购货源。'
      }
    ],
    out: path.join(zhDir, 'screenshot_3_1280x800.png')
  }
];

async function run() {
  console.log('Rendering Hero Focus 1280x800 Screenshots...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    for (const sc of [...enScreenshots, ...zhScreenshots]) {
      const html = getHeroHtml(sc);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: sc.out });
      console.log(`Rendered: ${path.basename(path.dirname(sc.out))}/${path.basename(sc.out)}`);
    }
  } finally {
    await browser.close();
  }
  console.log('All 6 Hero Focus Screenshots rendered successfully!');
}

run().catch(console.error);
