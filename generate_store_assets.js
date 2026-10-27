import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const rawDir = path.resolve('store_assets/raw');
const enDir = path.resolve('store_assets/en');
const zhDir = path.resolve('store_assets/zh');
const storeAssetsDir = path.resolve('store_assets');

if (!fs.existsSync(enDir)) fs.mkdirSync(enDir, { recursive: true });
if (!fs.existsSync(zhDir)) fs.mkdirSync(zhDir, { recursive: true });

// Convert images to base64 for embedding directly into HTML
function toBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

const squircleIconB64 = toBase64(path.resolve('store_assets/icon_squircle.png'));
const enInsightsB64 = toBase64(path.join(rawDir, 'en_tab1_insights.png'));
const enRadarB64 = toBase64(path.join(rawDir, 'en_tab2_radar.png'));
const enSourcingB64 = toBase64(path.join(rawDir, 'en_tab3_sourcing.png'));
const zhInsightsB64 = toBase64(path.join(rawDir, 'zh_tab1_insights.png'));
const zhRadarB64 = toBase64(path.join(rawDir, 'zh_tab2_radar.png'));
const zhSourcingB64 = toBase64(path.join(rawDir, 'zh_tab3_sourcing.png'));

async function renderAndSave(browser, html, width, height, outputPath) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outputPath });
  await page.close();
  console.log(`Rendered: ${path.basename(outputPath)} (${width}x${height})`);
}

function getScreenshotHtml(config) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 1280px;
      height: 800px;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 50%, #020617 100%);
      color: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 24px 32px 0 32px;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .headline-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .tag {
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8;
      font-size: 13px;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .title {
      font-size: 23px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.3px;
    }
    .title span {
      color: #38bdf8;
    }
    .browser-frame {
      flex: 1;
      background: #0f172a;
      border-radius: 14px 14px 0 0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-bottom: none;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px -10px rgba(6, 182, 212, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .browser-titlebar {
      height: 38px;
      background: #1e293b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 12px;
    }
    .traffic-lights {
      display: flex;
      gap: 7px;
    }
    .light {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .light.red { background: #ef4444; }
    .light.yellow { background: #f59e0b; }
    .light.green { background: #10b981; }
    .url-bar {
      flex: 1;
      max-width: 540px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 7px;
      height: 24px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 11px;
      color: #94a3b8;
      gap: 6px;
    }
    .url-bar svg {
      width: 12px;
      height: 12px;
      stroke: #38bdf8;
    }
    .browser-content {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .browser-content img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: right top;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="headline-wrap">
      <div class="tag">${config.tag}</div>
      <div class="title">${config.title}</div>
    </div>
    <div style="font-size: 13px; color: #94a3b8; font-weight: 600;">DropGuard • Chrome Extension</div>
  </div>
  <div class="browser-frame">
    <div class="browser-titlebar">
      <div class="traffic-lights">
        <div class="light red"></div>
        <div class="light yellow"></div>
        <div class="light green"></div>
      </div>
      <div class="url-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>${config.url}</span>
      </div>
    </div>
    <div class="browser-content">
      <img src="${config.imageB64}" alt="Screenshot" />
    </div>
  </div>
</body>
</html>`;
}

function getSmallPromoHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 440px;
      height: 280px;
      background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 60%, #020617 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      text-align: center;
      padding: 24px;
      position: relative;
    }
    .glow {
      position: absolute;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(6, 182, 212, 0) 70%);
      top: 15px;
      border-radius: 50%;
      pointer-events: none;
    }
    .icon {
      width: 82px;
      height: 82px;
      position: relative;
      z-index: 2;
      filter: drop-shadow(0 12px 24px rgba(6, 182, 212, 0.4));
      margin-bottom: 14px;
    }
    h1 {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
      position: relative;
      z-index: 2;
      background: linear-gradient(135deg, #ffffff 40%, #bae6fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 8px;
      position: relative;
      z-index: 2;
    }
    p {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      position: relative;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="glow"></div>
  <img class="icon" src="${squircleIconB64}" alt="DropGuard Icon" />
  <h1>DropGuard</h1>
  <div class="pill">
    <span>Shopify & IP Radar</span>
  </div>
  <p>Eliminate TRO Risks • Maximize Margins</p>
</body>
</html>`;
}

function getMarqueePromoHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body {
      width: 1400px;
      height: 560px;
      background: radial-gradient(circle at 75% 40%, #1e293b 0%, #0f172a 45%, #020617 100%);
      color: #fff;
      display: flex;
      overflow: hidden;
      position: relative;
      padding: 0 70px;
      align-items: center;
      justify-content: space-between;
    }
    .glow-bg {
      position: absolute;
      right: 200px;
      top: 50px;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, rgba(6, 182, 212, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .left-content {
      max-width: 580px;
      z-index: 2;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .brand-icon {
      width: 64px;
      height: 64px;
      filter: drop-shadow(0 10px 20px rgba(6, 182, 212, 0.35));
    }
    .brand-text {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 40%, #bae6fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .pro-pill {
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    h2 {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.3;
      margin-bottom: 14px;
      color: #f1f5f9;
    }
    h2 span {
      color: #38bdf8;
    }
    p {
      font-size: 15px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .badges-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .badge-card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      backdrop-filter: blur(8px);
    }
    .badge-card svg {
      width: 16px;
      height: 16px;
      color: #38bdf8;
    }
    .right-preview {
      position: relative;
      z-index: 2;
      width: 620px;
      height: 460px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-card {
      width: 580px;
      height: 420px;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(6, 182, 212, 0.25);
      background: #0f172a;
    }
    .preview-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: right top;
      display: block;
    }
  </style>
</head>
<body>
  <div class="glow-bg"></div>
  <div class="left-content">
    <div class="brand-row">
      <img class="brand-icon" src="${squircleIconB64}" alt="Logo" />
      <span class="brand-text">DropGuard</span>
      <span class="pro-pill">PRO RADAR</span>
    </div>
    <h2>Shopify Intelligence & <span>Legal IP Infringement Defense</span></h2>
    <p>Automate competitor spying, eliminate predatory TRO lawsuits before listing, and unlock 1688 direct factory pricing.</p>
    <div class="badges-grid">
      <div class="badge-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Real-Time TRO Radar</span>
      </div>
      <div class="badge-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        <span>Shopify Theme & Catalog Spy</span>
      </div>
      <div class="badge-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        <span>1688 Factory Sourcing</span>
      </div>
      <div class="badge-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <span>Pure English & 简体中文</span>
      </div>
    </div>
  </div>
  <div class="right-preview">
    <div class="preview-card">
      <img src="${enRadarB64}" alt="DropGuard Preview" />
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('Starting store asset generation via Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Small Promo Tile (440x280)
    await renderAndSave(
      browser,
      getSmallPromoHtml(),
      440,
      280,
      path.join(storeAssetsDir, 'small_promo_tile_440x280.png')
    );

    // 2. Marquee Promo Tile (1400x560)
    await renderAndSave(
      browser,
      getMarqueePromoHtml(),
      1400,
      560,
      path.join(storeAssetsDir, 'marquee_promo_tile_1400x560.png')
    );

    // 3. English Screenshots (1280x800)
    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: 'Store Insights',
        title: 'Instant Shopify Theme & <span>Live Catalog Spy</span>',
        url: 'https://aurastore.com (Shopify)',
        imageB64: enInsightsB64
      }),
      1280,
      800,
      path.join(enDir, 'screenshot_1_1280x800.png')
    );

    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: 'IP Defense',
        title: 'Pre-Listing <span>Trademark & TRO Infringement Radar</span>',
        url: 'https://aurastore.com/products/pikachu-night-light',
        imageB64: enRadarB64
      }),
      1280,
      800,
      path.join(enDir, 'screenshot_2_1280x800.png')
    );

    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: 'Supply Sourcing',
        title: '1688 Factory Sourcing & <span>Profit Margin Finder</span>',
        url: 'https://aurastore.com/products/cyberpunk-headphones',
        imageB64: enSourcingB64
      }),
      1280,
      800,
      path.join(enDir, 'screenshot_3_1280x800.png')
    );

    // 4. Chinese Screenshots (1280x800)
    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: '独立站竞品透视',
        title: '一键反查 Shopify 模板、<span>在售规模与新品动向</span>',
        url: 'https://aurastore.com (Shopify 独立站)',
        imageB64: zhInsightsB64
      }),
      1280,
      800,
      path.join(zhDir, 'screenshot_1_1280x800.png')
    );

    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: '跨国侵权雷达',
        title: '上架前精准排查 <span>TRO 侵权诉讼高危词与品牌</span>',
        url: 'https://aurastore.com/products/pikachu-night-light',
        imageB64: zhRadarB64
      }),
      1280,
      800,
      path.join(zhDir, 'screenshot_2_1280x800.png')
    );

    await renderAndSave(
      browser,
      getScreenshotHtml({
        tag: '源头货源挖掘',
        title: '1688 源头工厂直达反查 & <span>真实毛利空间测算</span>',
        url: 'https://aurastore.com/products/cyberpunk-headphones',
        imageB64: zhSourcingB64
      }),
      1280,
      800,
      path.join(zhDir, 'screenshot_3_1280x800.png')
    );

    console.log('🎉 All Chrome Web Store assets generated successfully!');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
