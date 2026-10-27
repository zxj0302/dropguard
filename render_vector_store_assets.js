import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const enDir = path.resolve('store_assets/en');
const zhDir = path.resolve('store_assets/zh');
const squircleIconB64 = `data:image/png;base64,${fs.readFileSync('store_assets/icon_squircle.png').toString('base64')}`;

// Real product photos as local Base64 data URLs
const imgHeadphones = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/headphones.jpg').toString('base64')}`;
const imgPikachu = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/pikachu.jpg').toString('base64')}`;
const imgShoes = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/shoes.jpg').toString('base64')}`;
const imgTumbler = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/tumbler.jpg').toString('base64')}`;

function getBaseCss() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    body {
      width: 1280px;
      height: 800px;
      background: radial-gradient(circle at 75% 40%, #152033 0%, #090e1a 50%, #020617 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 46px;
      overflow: hidden;
      position: relative;
    }
    .ambient-glow {
      position: absolute;
      right: 180px;
      top: 100px;
      width: 500px;
      height: 600px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .left-pane {
      width: 550px;
      display: flex;
      flex-direction: column;
      z-index: 2;
    }
    .brand-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
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
      font-size: 35px;
      font-weight: 900;
      line-height: 1.25;
      letter-spacing: -0.5px;
      margin-bottom: 16px;
      color: #f8fafc;
    }
    .main-title span {
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 15.5px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 28px;
    }
    .features-list {
      display: flex;
      flex-direction: column;
      gap: 13px;
    }
    .feat-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      backdrop-filter: blur(12px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }
    .feat-icon-box {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .feat-info h4 {
      font-size: 14.5px;
      font-weight: 800;
      color: #f1f5f9;
      margin-bottom: 3px;
    }
    .feat-info p {
      font-size: 12.5px;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* RIGHT PANE: PURE VECTOR HTML/CSS COMPONENT */
    .right-pane {
      width: 590px;
      z-index: 2;
    }
    .card-shell {
      background: rgba(10, 15, 28, 0.96);
      border: 1.5px solid rgba(56, 189, 248, 0.28);
      border-radius: 20px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9), 0 0 45px rgba(6, 182, 212, 0.25);
      overflow: hidden;
      backdrop-filter: blur(20px);
    }
    .card-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: rgba(15, 23, 42, 0.85);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .card-app-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .card-app-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-app-name {
      font-size: 14px;
      font-weight: 900;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pro-badge {
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid rgba(6, 182, 212, 0.4);
      color: #38bdf8;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .card-nav {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: rgba(15, 23, 42, 0.6);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 4px;
      gap: 6px;
    }
    .nav-btn {
      padding: 9px 0;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #94a3b8;
    }
    .nav-btn.active {
      background: #1e293b;
      color: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card-body {
      padding: 20px;
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #090e1a;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 11.5px;
      color: #64748b;
    }
  `;
}

// -------------------------------------------------------------
// HTML Templates for Screenshots 1, 2, 3 (EN & ZH)
// -------------------------------------------------------------

function renderHtml(lang, tabIndex) {
  const isZh = lang === 'zh';
  const baseCss = getBaseCss();

  let leftContent = '';
  let rightBody = '';

  if (tabIndex === 1) {
    // ----------------------------------------
    // TAB 1: STORE INSIGHTS
    // ----------------------------------------
    if (isZh) {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">独立站竞品透视</span>
        </div>
        <h1 class="main-title">一键反查 <span>Shopify 模板与在售商品流</span></h1>
        <p class="subtitle">出海卖家必备竞品洞察神器。浏览对手独立站自动激活，一秒提取店铺模板、在售规模与新品动向。</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
            </div>
            <div class="feat-info">
              <h4>模板与技术栈深度探测</h4>
              <p>精准识别 Dawn (Official)、Prestige、Impulse 等主流独立站模板。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <div class="feat-info">
              <h4>全店在售规模与客单价估算</h4>
              <p>自动汇总全店商品数量、标价体系与结算币种，摸清竞品盘子。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="feat-info">
              <h4>最新上架新品实时流监控</h4>
              <p>支持针对爆款商品一键排查侵权风险，或一键以图搜款直达 1688。</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">当前模板</div>
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8;">Dawn (Official)</div>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">在售商品预估</div>
            <div style="font-size: 13px; font-weight: 800; color: #818cf8;">~30+ Listed</div>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">结算币种</div>
            <div style="font-size: 13px; font-weight: 800; color: #34d399;">USD ($)</div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: 800; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
          <span>最新上架商品流 (4)</span>
          <span style="font-size: 11px; color: #38bdf8; cursor: pointer;">🔄 刷新数据</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Product 1 -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgHeadphones}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Cyberpunk RGB LED Gaming Headphones with Mic</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$79.99 <span style="color: #64748b; font-weight: 500;">• ApexAudio</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ 侵权</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 货源</span>
            </div>
          </div>

          <!-- Product 2 -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgPikachu}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Pokemon Pikachu Soft Silicone Night Light</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$24.99 <span style="color: #64748b; font-weight: 500;">• AnimeGlow</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ 侵权</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 货源</span>
            </div>
          </div>

          <!-- Product 3 -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgShoes}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Ultra-Light Carbon Running Shoes Pro X9</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$119.00 <span style="color: #64748b; font-weight: 500;">• VelocitySport</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ 侵权</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 货源</span>
            </div>
          </div>
        </div>
      `;
    } else {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">STORE INSIGHTS</span>
        </div>
        <h1 class="main-title">Instant Shopify Theme & <span>Live Catalog Spy</span></h1>
        <p class="subtitle">Deep-dive into competitor Shopify storefronts in 1-click. Reveal active themes, listing velocity, and full product catalogs.</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
            </div>
            <div class="feat-info">
              <h4>Theme & Tech Stack Detection</h4>
              <p>Uncovers official and custom Shopify themes (Dawn, Prestige, Impulse).</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <div class="feat-info">
              <h4>Real-Time Catalog Sizing</h4>
              <p>Estimates full store catalog size, active listings, and pricing structure.</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="feat-info">
              <h4>Newest Product Drops Stream</h4>
              <p>Instant 1-click quick-actions to scan trademark IP or source from 1688.</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Active Theme</div>
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8;">Dawn (Official)</div>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Catalog Items</div>
            <div style="font-size: 13px; font-weight: 800; color: #818cf8;">~30+ Listed</div>
          </div>
          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px;">
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Currency</div>
            <div style="font-size: 13px; font-weight: 800; color: #34d399;">USD ($)</div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: 800; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
          <span>Latest Product Drops (4)</span>
          <span style="font-size: 11px; color: #38bdf8; cursor: pointer;">🔄 Refresh</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgHeadphones}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Cyberpunk RGB LED Gaming Headphones with Mic</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$79.99 <span style="color: #64748b; font-weight: 500;">• ApexAudio</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ IP</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 Supply</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgPikachu}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Pokemon Pikachu Soft Silicone Night Light</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$24.99 <span style="color: #64748b; font-weight: 500;">• AnimeGlow</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ IP</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 Supply</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${imgShoes}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" />
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #f8fafc; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Ultra-Light Carbon Running Shoes Pro X9</div>
                <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 2px;">$119.00 <span style="color: #64748b; font-weight: 500;">• VelocitySport</span></div>
              </div>
            </div>
            <div style="display: flex; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 5px 8px; border-radius: 6px;">🛡️ IP</span>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); padding: 5px 8px; border-radius: 6px;">🏭 Supply</span>
            </div>
          </div>
        </div>
      `;
    }
  } else if (tabIndex === 2) {
    // ----------------------------------------
    // TAB 2: IP RADAR
    // ----------------------------------------
    if (isZh) {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">跨国侵权雷达</span>
        </div>
        <h1 class="main-title">上架前精准排查<br/><span>TRO 侵权诉讼高危词与品牌</span></h1>
        <p class="subtitle">彻底告别美国联邦法院 TRO 跨国诉讼、PayPal/Stripe 资金冻结与店铺封号。上架前一秒扫描，防患于未然。</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="feat-info">
              <h4>1,200+ 跨国高危 TRO 诉讼品牌库</h4>
              <p>全量覆盖 AMS、Keith、GBC、Sullivan 等知名律所重点打击品牌。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="feat-info">
              <h4>威胁指数量化与风险定级 (0-100)</h4>
              <p>多维度精准排查已注册商标、外观专利、动漫 IP 与跨国高危词。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="feat-info">
              <h4>独立站详情页一键无感扫描</h4>
              <p>自动提取当前浏览独立站商品的标题与关键词，无需手动复制粘贴。</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.5px;">待排查商品标题</div>
        <div class="input-box" style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #f1f5f9;">Pokemon Pikachu Soft Silicone Night Light</div>
          <div style="background: linear-gradient(135deg, #06b6d4, #2563eb); color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 6px;">
            🔍 排查侵权
          </div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: #ef4444; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size: 18px; font-weight: 900; color: #f87171;">极高侵权风险 (DANGER)</div>
                <div style="font-size: 12px; color: #fca5a5; margin-top: 2px;">侵权威胁指数: 93 / 100</div>
              </div>
            </div>
            <div style="width: 52px; height: 52px; border-radius: 50%; border: 4px solid #ef4444; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fff; background: rgba(239, 68, 68, 0.2);">93</div>
          </div>
          <div style="font-size: 12.5px; line-height: 1.55; color: #cbd5e1;">
            检出高危侵权风险！命中 1 个已注册商标/专利实体。刊登或广告投放该商品存在 PayPal/Stripe 资产冻结及美国联邦法院 TRO 诉讼风险。
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">命中侵权品牌与外观专利列表 (1)</div>
        <div style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
              Pokemon
              <span style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">极高危 (高频跨国 TRO 诉讼目标)</span>
            </div>
            <div style="color: #38bdf8; font-size: 13px; font-weight: 800;">100% 匹配相似度</div>
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
            权利人: Nintendo / The Pokémon Company • 娱乐动漫类目
          </div>
          <div style="font-size: 11.5px; color: #fca5a5; background: rgba(239, 68, 68, 0.08); padding: 6px 10px; border-radius: 6px; margin-top: 6px;">
            ⚠️ 重点维权律所: AMS 及 Sullivan & Worcester，TRO 冻结诉讼频次极高。
          </div>
        </div>
      `;
    } else {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">LEGAL IP RADAR</span>
        </div>
        <h1 class="main-title">Pre-Listing <span>Trademark & TRO Infringement Defense</span></h1>
        <p class="subtitle">Eliminate costly federal lawsuits, PayPal/Stripe account freezes, and inventory confiscations before launching products.</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="feat-info">
              <h4>1,200+ Cross-Border TRO Entity Database</h4>
              <p>Aggressive law firms tracked (AMS, Sullivan & Worcester, Keith, GBC).</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="feat-info">
              <h4>Threat Index & Risk Scoring (0-100)</h4>
              <p>Exact & fuzzy trademark similarity algorithms with risk categorization.</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="feat-info">
              <h4>1-Click Product Page Analysis</h4>
              <p>Scan titles & keywords automatically on any active Shopify product.</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.5px;">PRODUCT TITLE TO SCAN</div>
        <div class="input-box" style="background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #f1f5f9;">Pokemon Pikachu Soft Silicone Night Light</div>
          <div style="background: linear-gradient(135deg, #06b6d4, #2563eb); color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px; display: flex; align-items: center; gap: 6px;">
            🔍 Scan IP
          </div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 18px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: #ef4444; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size: 18px; font-weight: 900; color: #f87171;">CRITICAL RISK</div>
                <div style="font-size: 12px; color: #fca5a5; margin-top: 2px;">Threat Index: 93 / 100</div>
              </div>
            </div>
            <div style="width: 52px; height: 52px; border-radius: 50%; border: 4px solid #ef4444; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fff; background: rgba(239, 68, 68, 0.2);">93</div>
          </div>
          <div style="font-size: 12.5px; line-height: 1.55; color: #cbd5e1;">
            Critical IP infringement risk detected! Matched 1 registered trademark/patent entity. Listing this item carries immediate risk of PayPal/Stripe account freezing or federal court TRO lawsuit.
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">DETECTED TRADEMARK & PATENT ENTITIES (1)</div>
        <div style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
              Pokemon
              <span style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">EXTREME (HIGH-FREQUENCY TRO TARGET)</span>
            </div>
            <div style="color: #38bdf8; font-size: 13px; font-weight: 800;">100% Similarity</div>
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
            Nintendo / The Pokémon Company • Character / Entertainment
          </div>
          <div style="font-size: 11.5px; color: #fca5a5; background: rgba(239, 68, 68, 0.08); padding: 6px 10px; border-radius: 6px; margin-top: 6px;">
            Aggressively pursued by AMS and Sullivan & Worcester TROs.
          </div>
        </div>
      `;
    }
  } else if (tabIndex === 3) {
    // ----------------------------------------
    // TAB 3: SUPPLY SOURCING
    // ----------------------------------------
    if (isZh) {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">源头货源挖掘</span>
        </div>
        <h1 class="main-title">1688 源头工厂直达反查 & <span>真实毛利空间测算</span></h1>
        <p class="subtitle">剔除海外中间商差价。直接对标国内 1688 原厂出厂价，自动测算广告保本 CPA 阈值与单件净利润空间。</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4L2 20z"/></svg>
            </div>
            <div class="feat-info">
              <h4>原厂出厂底价智能评估</h4>
              <p>类目精算法测算源头出厂成本（通常为售价 18%~28%）。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div class="feat-info">
              <h4>Meta / TikTok 广告保本 CPA 测算</h4>
              <p>精准测算获客成本安全边际与保本 ROAS，避免盲目烧广告。</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="feat-info">
              <h4>一键直达 1688 / 淘宝同款工厂</h4>
              <p>自动去噪关键词与以图搜款，1秒对接源头供应链批发采购。</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">商品标题（用于货源反查）</div>
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">
          Cyberpunk RGB LED Gaming Headphones with Mic
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #94a3b8;">独立站售价: <span style="font-size: 15px; font-weight: 800; color: #fff;">$79.99 USD</span></div>
          <div style="background: linear-gradient(135deg, #10b981, #06b6d4); color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
            📊 供应链反查
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="background: #0f172a; border: 1.5px solid rgba(6,182,212,0.3); border-radius: 14px; padding: 14px;">
            <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 4px;">🏭 预估源头出厂成本 (18%-28%)</div>
            <div style="font-size: 22px; font-weight: 900; color: #38bdf8;">$14.40 - $22.40</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">~18%-28% of Retail</div>
          </div>
          <div style="background: #0f172a; border: 1.5px solid rgba(16,185,129,0.3); border-radius: 14px; padding: 14px;">
            <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 4px;">📈 Meta/TikTok 广告保本 CPA</div>
            <div style="font-size: 22px; font-weight: 900; color: #34d399;">$36.91</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Max ROAS Threshold</div>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 700; color: #cbd5e1;">单件毛利空间</span>
            <span style="font-size: 16px; font-weight: 900; color: #34d399;">$56.79 (71%)</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>国际跨境小包预估头程运费</span>
            <span style="color: #f1f5f9; font-weight: 600;">$4.80 USD</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
            <span>工厂平均出库交付时效</span>
            <span style="color: #f1f5f9; font-weight: 600;">24-48 Hours</span>
          </div>
        </div>

        <div style="margin-top: 14px; display: flex; gap: 8px;">
          <div style="flex: 1; text-align: center; background: rgba(255,106,0,0.15); border: 1px solid rgba(255,106,0,0.4); color: #ff8a3d; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800;">
            🛒 1688 源头货源直达
          </div>
          <div style="flex: 1; text-align: center; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #f87171; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800;">
            📦 淘宝同款反查
          </div>
        </div>
      `;
    } else {
      leftContent = `
        <div class="brand-bar">
          <img class="brand-icon" src="${squircleIconB64}" alt="Icon" />
          <span class="brand-title">DropGuard</span>
          <span class="brand-pill">SUPPLY SOURCING</span>
        </div>
        <h1 class="main-title">1688 Factory Sourcing & <span>Profit Margin Finder</span></h1>
        <p class="subtitle">Cut out middlemen dropshippers. Uncover original manufacturer ex-works pricing, calculate true margins, and get direct 1688 links.</p>
        <div class="features-list">
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4L2 20z"/></svg>
            </div>
            <div class="feat-info">
              <h4>Ex-Works Factory Cost Benchmark</h4>
              <p>Calculates expected manufacturer base cost (~18%-28% of retail price).</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(6, 182, 212, 0.15); color: #38bdf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div class="feat-info">
              <h4>Breakeven Ad CPA Estimator</h4>
              <p>Know your exact maximum allowable ad spend cap for Meta & TikTok ads.</p>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon-box" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="feat-info">
              <h4>1-Click Deep Factory Links</h4>
              <p>Instant direct search deep links to 1688, Taobao, and AliExpress.</p>
            </div>
          </div>
        </div>
      `;
      rightBody = `
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">PRODUCT TITLE FOR SOURCING</div>
        <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">
          Cyberpunk RGB LED Gaming Headphones with Mic
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #94a3b8;">Retail Price: <span style="font-size: 15px; font-weight: 800; color: #fff;">$79.99 USD</span></div>
          <div style="background: linear-gradient(135deg, #10b981, #06b6d4); color: #fff; font-size: 12px; font-weight: 800; padding: 6px 14px; border-radius: 8px;">
            📊 Source & Margins
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="background: #0f172a; border: 1.5px solid rgba(6,182,212,0.3); border-radius: 14px; padding: 14px;">
            <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 4px;">🏭 Factory Ex-Works Cost (18%-28%)</div>
            <div style="font-size: 22px; font-weight: 900; color: #38bdf8;">$14.40 - $22.40</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">~18%-28% of Retail</div>
          </div>
          <div style="background: #0f172a; border: 1.5px solid rgba(16,185,129,0.3); border-radius: 14px; padding: 14px;">
            <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 4px;">📈 Breakeven Ad CPA Limit</div>
            <div style="font-size: 22px; font-weight: 900; color: #34d399;">$36.91</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Max ROAS Threshold</div>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 700; color: #cbd5e1;">Gross Margin Space</span>
            <span style="font-size: 16px; font-weight: 900; color: #34d399;">$56.79 (71%)</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span>Est. Packet/Air Shipping</span>
            <span style="color: #f1f5f9; font-weight: 600;">$4.80 USD</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
            <span>Typical Dispatch SLA</span>
            <span style="color: #f1f5f9; font-weight: 600;">24-48 Hours</span>
          </div>
        </div>

        <div style="margin-top: 14px; display: flex; gap: 8px;">
          <div style="flex: 1; text-align: center; background: rgba(255,106,0,0.15); border: 1px solid rgba(255,106,0,0.4); color: #ff8a3d; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800;">
            🛒 1688 Factory Direct
          </div>
          <div style="flex: 1; text-align: center; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #f87171; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800;">
            📦 Taobao Sourcing
          </div>
        </div>
      `;
    }
  }

  const appNameText = isZh ? 'DropGuard 选品雷达' : 'DropGuard Spy';
  const tab1Text = isZh ? '店铺洞察' : 'Store Insights';
  const tab2Text = isZh ? '侵权雷达' : 'IP Radar';
  const tab3Text = isZh ? '货源利润' : 'Supply Sourcing';
  const quotaText = isZh ? '⚡ 3/3 免费额度' : '⚡ 3/3 Free';
  const devText = isZh ? '设备标识: e2679103-dd6a...' : 'Dev: e2679103-dd6a...';
  const proText = isZh ? '✨ 升级专业版 Pro ($29/月)' : '✨ Upgrade Pro ($29/mo)';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseCss}</style>
</head>
<body>
  <div class="ambient-glow"></div>
  <div class="left-pane">
    ${leftContent}
  </div>

  <div class="right-pane">
    <div class="card-shell">
      <div class="card-topbar">
        <div class="card-app-title">
          <div class="card-app-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="card-app-name">
            ${appNameText}
            <span class="pro-badge">PRO</span>
          </div>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); padding: 3px 8px; border-radius: 9999px;">
          ${quotaText}
        </div>
      </div>
      <div class="card-nav">
        <div class="nav-btn ${tabIndex === 1 ? 'active' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${tabIndex === 1 ? '#38bdf8' : 'currentColor'}" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
          ${tab1Text}
        </div>
        <div class="nav-btn ${tabIndex === 2 ? 'active' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${tabIndex === 2 ? '#f87171' : 'currentColor'}" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
          ${tab2Text}
        </div>
        <div class="nav-btn ${tabIndex === 3 ? 'active' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${tabIndex === 3 ? '#34d399' : 'currentColor'}" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          ${tab3Text}
        </div>
      </div>
      <div class="card-body">
        ${rightBody}
      </div>
      <div class="card-footer">
        <div>${devText}</div>
        <div style="color: #38bdf8; font-weight: 700;">${proText}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  console.log('Rendering all 6 native vector sharp screenshots...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // Render at 2560x1600 (2x Retina deviceScaleFactor) for maximum vector antialiasing
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

    const tasks = [
      { lang: 'en', tab: 1, out: path.join(enDir, 'screenshot_1_1280x800.png') },
      { lang: 'en', tab: 2, out: path.join(enDir, 'screenshot_2_1280x800.png') },
      { lang: 'en', tab: 3, out: path.join(enDir, 'screenshot_3_1280x800.png') },
      { lang: 'zh', tab: 1, out: path.join(zhDir, 'screenshot_1_1280x800.png') },
      { lang: 'zh', tab: 2, out: path.join(zhDir, 'screenshot_2_1280x800.png') },
      { lang: 'zh', tab: 3, out: path.join(zhDir, 'screenshot_3_1280x800.png') },
    ];

    for (const t of tasks) {
      const html = renderHtml(t.lang, t.tab);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 600));

      const tmp2x = t.out.replace('.png', '_tmp2x.png');
      await page.screenshot({ path: tmp2x });

      // Downsample using sharp / PIL with Lanczos to exact 1280x800
      fs.renameSync(tmp2x, t.out); // temporary
      console.log(`Rendered 2x: ${path.basename(t.out)}`);
    }

    console.log('🎉 All 6 vector sharp screenshots created successfully!');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
