import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const iconB64 = `data:image/png;base64,${fs.readFileSync('store_assets/icon_512x512.png').toString('base64')}`;

async function renderPromos() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. English Small Promo (440x280)
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 2 });
  await page.setContent(`<!DOCTYPE html>
  <html>
  <head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    body { width: 440px; height: 280px; background: #070d1d radial-gradient(circle at 75% 40%, #152952 0%, #070d1d 75%); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; overflow: hidden; }
    .left { display: flex; flex-direction: column; gap: 8px; z-index: 2; }
    .badge { background: rgba(14, 165, 233, 0.22); border: 1px solid #0ea5e9; color: #38bdf8; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; width: fit-content; }
    .title { font-size: 26px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; }
    .highlight { background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { font-size: 11px; color: #cbd5e1; font-weight: 600; line-height: 1.45; max-width: 215px; margin-top: 4px; }
    .right { z-index: 2; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.6)); }
    .right img { width: 140px; height: 140px; object-fit: contain; }
  </style>
  </head>
  <body>
    <div class="left">
      <div class="badge">SHOPIFY & SOURCING SPY</div>
      <div class="title">DropGuard<br><span class="highlight">Ecom Spy Radar</span></div>
      <div class="sub">TRO Lawsuit Defense • 1688 Factory Cost Finder • Live Shopify Competitor Drops</div>
    </div>
    <div class="right">
      <img src="${iconB64}" />
    </div>
  </body>
  </html>`);
  await page.screenshot({ path: 'store_assets/en/small_promo_tile_440x280.png', type: 'png' });
  console.log('Saved EN small promo');

  // 2. English Marquee Promo (1400x560)
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 2 });
  await page.setContent(`<!DOCTYPE html>
  <html>
  <head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    body { width: 1400px; height: 560px; background: #060a16 radial-gradient(circle at 75% 45%, #15254a 0%, #060a16 75%); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 100px; overflow: hidden; position: relative; }
    .left { width: 720px; display: flex; flex-direction: column; gap: 14px; z-index: 2; }
    .pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(14, 165, 233, 0.2); border: 1.5px solid #0ea5e9; color: #38bdf8; font-size: 13.5px; font-weight: 800; padding: 5px 14px; border-radius: 20px; width: fit-content; }
    .title { font-size: 50px; font-weight: 900; line-height: 1.15; letter-spacing: -1px; }
    .highlight { background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { font-size: 17.5px; color: #cbd5e1; line-height: 1.6; max-width: 660px; }
    .tags { display: flex; gap: 12px; margin-top: 10px; }
    .tag { background: #0f192f; border: 1.5px solid #1e293b; color: #f8fafc; font-size: 14px; font-weight: 700; padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 6px; }
    .right { z-index: 2; filter: drop-shadow(0 25px 50px rgba(0,0,0,0.7)); }
    .right img { width: 340px; height: 340px; object-fit: contain; }
  </style>
  </head>
  <body>
    <div class="left">
      <div class="pill">⚡ Essential Tool for Shopify & Dropshipping Sellers</div>
      <div class="title">DropGuard Spy Radar<br><span class="highlight">TRO Defense & Sourcing Margins</span></div>
      <div class="sub">Screen 1,200+ aggressive lawsuit brands before listing. Instantly spy on competitor Shopify themes & live catalogs, and calculate true 1688 manufacturer ex-works cost margins.</div>
      <div class="tags">
        <div class="tag">🛡️ 1,200+ TRO Brands</div>
        <div class="tag">🏪 Shopify Theme & Drops</div>
        <div class="tag">💰 1688 Sourcing & Margins</div>
      </div>
    </div>
    <div class="right">
      <img src="${iconB64}" />
    </div>
  </body>
  </html>`);
  await page.screenshot({ path: 'store_assets/en/marquee_promo_tile_1400x560.png', type: 'png' });
  console.log('Saved EN marquee promo');

  // 3. Chinese Small Promo (440x280)
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 2 });
  await page.setContent(`<!DOCTYPE html>
  <html>
  <head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; -webkit-font-smoothing: antialiased; }
    body { width: 440px; height: 280px; background: #070d1d radial-gradient(circle at 75% 40%, #152952 0%, #070d1d 75%); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; overflow: hidden; }
    .left { display: flex; flex-direction: column; gap: 8px; z-index: 2; }
    .badge { background: rgba(14, 165, 233, 0.22); border: 1px solid #0ea5e9; color: #38bdf8; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px; width: fit-content; }
    .title { font-size: 26px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; }
    .highlight { background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { font-size: 11.5px; color: #cbd5e1; font-weight: 600; line-height: 1.4; max-width: 210px; margin-top: 4px; }
    .right { z-index: 2; filter: drop-shadow(0 15px 30px rgba(0,0,0,0.6)); }
    .right img { width: 140px; height: 140px; object-fit: contain; }
  </style>
  </head>
  <body>
    <div class="left">
      <div class="badge">SHOPIFY & 1688 SPY</div>
      <div class="title">DropGuard<br><span class="highlight">出海选品雷达</span></div>
      <div class="sub">TRO 侵权预警 • 1688 源头底价 • 独立站竞品流实时监控</div>
    </div>
    <div class="right">
      <img src="${iconB64}" />
    </div>
  </body>
  </html>`);
  await page.screenshot({ path: 'store_assets/zh/small_promo_tile_440x280.png', type: 'png' });
  console.log('Saved ZH small promo');

  // 4. Chinese Marquee Promo (1400x560)
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 2 });
  await page.setContent(`<!DOCTYPE html>
  <html>
  <head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; -webkit-font-smoothing: antialiased; }
    body { width: 1400px; height: 560px; background: #060a16 radial-gradient(circle at 75% 45%, #15254a 0%, #060a16 75%); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 100px; overflow: hidden; position: relative; }
    .left { width: 680px; display: flex; flex-direction: column; gap: 14px; z-index: 2; }
    .pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(14, 165, 233, 0.2); border: 1.5px solid #0ea5e9; color: #38bdf8; font-size: 13.5px; font-weight: 800; padding: 5px 14px; border-radius: 20px; width: fit-content; }
    .title { font-size: 52px; font-weight: 900; line-height: 1.15; letter-spacing: -1px; }
    .highlight { background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .sub { font-size: 18px; color: #cbd5e1; line-height: 1.6; max-width: 600px; }
    .tags { display: flex; gap: 12px; margin-top: 10px; }
    .tag { background: #0f192f; border: 1.5px solid #1e293b; color: #f8fafc; font-size: 14px; font-weight: 700; padding: 8px 16px; border-radius: 10px; display: flex; align-items: center; gap: 6px; }
    .right { z-index: 2; filter: drop-shadow(0 25px 50px rgba(0,0,0,0.7)); }
    .right img { width: 340px; height: 340px; object-fit: contain; }
  </style>
  </head>
  <body>
    <div class="left">
      <div class="pill">⚡ 出海独立站卖家必备工具</div>
      <div class="title">DropGuard 选品雷达<br><span class="highlight">TRO 侵权防护 & 货源利润</span></div>
      <div class="sub">上架前一秒排查 1,200+ 跨国诉讼品牌，一键透视竞品 Shopify 模板与在售商品，直连 1688 原厂出厂价与净利润空间。</div>
      <div class="tags">
        <div class="tag">🛡️ 1,200+ TRO 诉讼库</div>
        <div class="tag">🏪 Shopify 模板/新品流</div>
        <div class="tag">💰 1688 源头底价测算</div>
      </div>
    </div>
    <div class="right">
      <img src="${iconB64}" />
    </div>
  </body>
  </html>`);
  await page.screenshot({ path: 'store_assets/zh/marquee_promo_tile_1400x560.png', type: 'png' });
  console.log('Saved ZH marquee promo');

  await browser.close();

  // Downsample to exact dimensions and 24-bit RGB (no alpha)
  execSync(`python3 -c "
from PIL import Image
import shutil

for lang in ['en', 'zh']:
    p_small = f'store_assets/{lang}/small_promo_tile_440x280.png'
    im_small = Image.open(p_small).convert('RGB')
    im_small = im_small.resize((440, 280), Image.Resampling.LANCZOS)
    im_small.save(p_small, 'PNG', optimize=True)

    p_marq = f'store_assets/{lang}/marquee_promo_tile_1400x560.png'
    im_marq = Image.open(p_marq).convert('RGB')
    im_marq = im_marq.resize((1400, 560), Image.Resampling.LANCZOS)
    im_marq.save(p_marq, 'PNG', optimize=True)

# Also copy EN version as default store root
shutil.copyfile('store_assets/en/small_promo_tile_440x280.png', 'store_assets/small_promo_tile_440x280.png')
shutil.copyfile('store_assets/en/marquee_promo_tile_1400x560.png', 'store_assets/marquee_promo_tile_1400x560.png')
print('Finished resizing and copying promos to RGB 440x280 and 1400x560!')
"`);
}

renderPromos();
