import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const squircleIconB64 = `data:image/png;base64,${fs.readFileSync('store_assets/icon_squircle.png').toString('base64')}`;
const imgHeadphones = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/headphones.jpg').toString('base64')}`;
const imgPikachu = `data:image/jpeg;base64,${fs.readFileSync('store_assets/thumbs/pikachu.jpg').toString('base64')}`;

const enDir = path.resolve('store_assets/en');
const zhDir = path.resolve('store_assets/zh');

function getBaseCss() {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }
    body {
      width: 1280px;
      height: 800px;
      background: #050811 radial-gradient(circle at 78% 38%, #132247 0%, #050811 70%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 52px;
      overflow: hidden;
      position: relative;
    }
    
    /* Left Hero Column */
    .left-pane {
      width: 470px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      z-index: 2;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
    }
    .brand-logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
    }
    .brand-name {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .tag-pill {
      background: rgba(14, 165, 233, 0.22);
      border: 1.5px solid #0ea5e9;
      color: #38bdf8;
      font-size: 13.5px;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 20px;
    }
    .hero-title {
      font-size: 40px;
      font-weight: 900;
      line-height: 1.25;
      letter-spacing: -0.8px;
      color: #ffffff;
      margin-bottom: 18px;
    }
    .highlight-blue {
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-desc {
      font-size: 16px;
      line-height: 1.65;
      color: #e2e8f0;
      margin-bottom: 28px;
    }
    .feature-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(15, 23, 42, 0.8);
      border: 1.5px solid #1e293b;
      border-radius: 14px;
      padding: 14px 18px;
    }
    .feature-icon-box {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }
    .feature-title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 3px;
    }
    .feature-sub {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* Right Card - Macro Zoomed */
    .card-container {
      width: 660px;
      height: 680px;
      background: #090f1f;
      border: 1.5px solid #233354;
      border-radius: 22px;
      box-shadow: 0 30px 80px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.16);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 2;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      background: #0f192f;
      border-bottom: 1.5px solid #1e293b;
    }
    .card-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card-header-title {
      font-size: 17.5px;
      font-weight: 900;
      color: #ffffff;
    }
    .pro-pill {
      background: rgba(6, 182, 212, 0.25);
      border: 1px solid #06b6d4;
      color: #22d3ee;
      font-size: 11.5px;
      font-weight: 900;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .quota-badge {
      background: rgba(16, 185, 129, 0.18);
      border: 1.5px solid rgba(16, 185, 129, 0.45);
      color: #34d399;
      font-size: 14px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Nav Tabs */
    .card-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      padding: 16px 22px 0 22px;
    }
    .tab-btn {
      padding: 11px 0;
      text-align: center;
      font-size: 15px;
      font-weight: 800;
      color: #64748b;
      border-radius: 10px;
      background: #0f172a;
      border: 1px solid #1e293b;
    }
    .tab-btn.active {
      color: #ffffff;
      background: #1e293b;
      border-color: #38bdf8;
      box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
    }

    .card-body {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex: 1;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0f172a;
      border: 1.5px solid #1e293b;
      border-radius: 12px;
      padding: 10px 16px;
    }
    .card-footer-tip {
      font-size: 13px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-footer-btn {
      font-size: 13px;
      font-weight: 800;
      color: #38bdf8;
      cursor: pointer;
    }
  `;
}

// 6 Templates
function buildHtml(lang, shotNum) {
  const isEn = lang === 'en';

  if (shotNum === 1) {
    // Shot 1: Theme & Catalog Spy
    const heroTitle = isEn
      ? `Instant Shopify Theme<br><span class="highlight-blue">& Live Catalog Spy</span>`
      : `一键反查 Shopify<br><span class="highlight-blue">建站模板与在售商品流</span>`;
    const heroDesc = isEn
      ? `Deep-dive into competitor Shopify storefronts in 1-click. Reveal active themes, listing velocity, pricing structures, and newest product drops instantly.`
      : `出海卖家必备竞品洞察神器。浏览对手独立站自动激活，一秒提取店铺模板、在售规模、客单价体系与最新上架爆款。`;
    const tag = isEn ? `STORE INSIGHTS` : `独立站竞品透视`;
    const tab1 = isEn ? `🏪 Store Insights` : `🏪 店铺洞察`;
    const tab2 = isEn ? `🎯 IP Radar` : `🎯 侵权雷达`;
    const tab3 = isEn ? `💰 Sourcing` : `💰 货源利润`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCss()}
      .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; }
      .meta-card { background: #0f192f; border: 1.5px solid #1e293b; border-radius: 12px; padding: 12px 14px; }
      .meta-label { font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 4px; }
      .meta-val { font-size: 16px; font-weight: 800; color: #38bdf8; }
      .stream-header { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
      .stream-title { font-size: 15px; font-weight: 800; color: #ffffff; }
      .stream-refresh { font-size: 13px; font-weight: 700; color: #38bdf8; }
      .product-row { display: flex; align-items: center; justify-content: space-between; background: #0f192f; border: 1.5px solid #233354; border-radius: 16px; padding: 14px 16px; }
      .prod-left { display: flex; align-items: center; gap: 14px; }
      .prod-img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; }
      .prod-title { font-size: 15.5px; font-weight: 800; color: #ffffff; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .prod-price { font-size: 13.5px; font-weight: 800; color: #34d399; margin-top: 4px; }
      .prod-btns { display: flex; gap: 8px; }
      .btn-ip { background: rgba(239, 68, 68, 0.18); border: 1.5px solid rgba(239, 68, 68, 0.45); color: #f87171; font-size: 13px; font-weight: 800; padding: 7px 12px; border-radius: 8px; }
      .btn-sourcing { background: rgba(6, 182, 212, 0.18); border: 1.5px solid rgba(6, 182, 212, 0.45); color: #22d3ee; font-size: 13px; font-weight: 800; padding: 7px 12px; border-radius: 8px; }
    </style></head><body>
      <div class="left-pane">
        <div class="brand-badge">
          <img class="brand-logo" src="${squircleIconB64}" />
          <span class="brand-name">DropGuard</span>
          <span class="tag-pill">${tag}</span>
        </div>
        <h1 class="hero-title">${heroTitle}</h1>
        <p class="hero-desc">${heroDesc}</p>
        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">🏪</div>
            <div>
              <div class="feature-title">${isEn ? 'Theme & Tech Stack Detection' : '模板与技术栈深度探测'}</div>
              <div class="feature-sub">${isEn ? 'Uncovers official & custom Shopify themes (Dawn, Prestige, Impulse).' : '精准识别 Dawn (Official)、Prestige、Impulse 等主流独立站模板。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">📊</div>
            <div>
              <div class="feature-title">${isEn ? 'Real-Time Catalog Sizing' : '全店在售规模与客单价估算'}</div>
              <div class="feature-sub">${isEn ? 'Estimates full store catalog size, active listings, and pricing structure.' : '自动汇总全店商品数量、标价体系与结算币种，摸清竞品盘子。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">⚡</div>
            <div>
              <div class="feature-title">${isEn ? 'Newest Product Drops Stream' : '最新上架新品实时流监控'}</div>
              <div class="feature-sub">${isEn ? 'Instant 1-click quick-actions to scan trademark IP or source from 1688.' : '针对在售爆款一键排查侵权风险，或一键以图搜款直达 1688。'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-container">
        <div class="card-header">
          <div class="card-header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span class="card-header-title">${isEn ? 'DropGuard Spy' : 'DropGuard 选品雷达'}</span>
            <span class="pro-pill">PRO</span>
          </div>
          <div class="quota-badge">⚡ ${isEn ? '3/3 Free Daily' : '3/3 今日免费'}</div>
        </div>

        <div class="card-tabs">
          <div class="tab-btn active">${tab1}</div>
          <div class="tab-btn">${tab2}</div>
          <div class="tab-btn">${tab3}</div>
        </div>

        <div class="card-body">
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">${isEn ? 'ACTIVE THEME' : '当前店铺模板'}</div>
              <div class="meta-val">Dawn (Official)</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">${isEn ? 'CATALOG ITEMS' : '在售商品预估'}</div>
              <div class="meta-val">~30+ Listed</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">${isEn ? 'STORE CURRENCY' : '结算币种'}</div>
              <div class="meta-val" style="color: #34d399;">USD ($)</div>
            </div>
          </div>

          <div class="stream-header">
            <span class="stream-title">${isEn ? 'Latest Product Drops (Real-Time)' : '最新在售新品流 (实时探测)'}</span>
            <span class="stream-refresh">🔄 ${isEn ? 'Refresh' : '刷新数据'}</span>
          </div>

          <div class="product-row">
            <div class="prod-left">
              <img class="prod-img" src="${imgHeadphones}" />
              <div>
                <div class="prod-title">Cyberpunk RGB LED Gaming Headphones with Mic</div>
                <div class="prod-price">$79.99 USD <span style="color: #94a3b8; font-weight: 500;">• ApexAudio</span></div>
              </div>
            </div>
            <div class="prod-btns">
              <span class="btn-ip">${isEn ? '🛡️ Scan IP' : '🛡️ 侵权排查'}</span>
              <span class="btn-sourcing">${isEn ? '🏭 Source' : '🏭 货源反查'}</span>
            </div>
          </div>

          <div class="product-row">
            <div class="prod-left">
              <img class="prod-img" src="${imgPikachu}" />
              <div>
                <div class="prod-title">Pokemon Pikachu Soft Silicone Night Light</div>
                <div class="prod-price">$24.99 USD <span style="color: #94a3b8; font-weight: 500;">• AnimeGlow</span></div>
              </div>
            </div>
            <div class="prod-btns">
              <span class="btn-ip">${isEn ? '🛡️ Scan IP' : '🛡️ 侵权排查'}</span>
              <span class="btn-sourcing">${isEn ? '🏭 Source' : '🏭 货源反查'}</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="card-footer-tip">
              <span>💡</span>
              <span>${isEn ? 'Tip: Click [Source] on any product to jump to 1688 manufacturer.' : '提示：点击任意商品【货源反查】可自动提取去噪关键词直连 1688'}</span>
            </div>
            <div class="card-footer-btn">${isEn ? 'Demo &rarr;' : '查看演示 &rarr;'}</div>
          </div>
        </div>
      </div>
    </body></html>`;
  }

  if (shotNum === 2) {
    // Shot 2: IP Radar
    const heroTitle = isEn
      ? `Pre-Listing Trademark &<br><span class="highlight-blue">TRO Infringement Defense</span>`
      : `上架前一键精准排查<br><span class="highlight-blue">TRO 侵权与资金冻结</span>`;
    const heroDesc = isEn
      ? `Eliminate costly federal lawsuits, PayPal/Stripe account freezes, and store bans. Screen every keyword and brand against 1,200+ aggressive litigation targets.`
      : `彻底告别美国联邦法院 TRO 跨国起诉、PayPal 与 Stripe 资产冻结及店铺封号。在上架前一秒完成知识产权扫描，防患于未然。`;
    const tag = isEn ? `LEGAL IP RADAR` : `跨境侵权雷达`;
    const tab1 = isEn ? `🏪 Store Insights` : `🏪 店铺洞察`;
    const tab2 = isEn ? `🎯 IP Radar` : `🎯 侵权雷达`;
    const tab3 = isEn ? `💰 Sourcing` : `💰 货源利润`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCss()}
      .search-wrapper { display: flex; flex-direction: column; gap: 8px; }
      .search-label { font-size: 13.5px; font-weight: 800; color: #e2e8f0; }
      .search-bar { display: flex; align-items: center; justify-content: space-between; background: #0f192f; border: 1.5px solid #334155; border-radius: 12px; padding: 8px 10px 8px 16px; }
      .search-val { font-size: 15.5px; font-weight: 700; color: #ffffff; }
      .scan-btn { background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; font-size: 13.5px; font-weight: 800; padding: 9px 20px; border-radius: 8px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4); }

      .danger-box { background: linear-gradient(180deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.08) 100%); border: 2px solid #ef4444; border-radius: 16px; padding: 16px 20px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2); }
      .danger-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .danger-left { display: flex; align-items: center; gap: 14px; }
      .danger-icon-badge { width: 48px; height: 48px; border-radius: 12px; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 26px; color: #ffffff; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5); }
      .danger-title { font-size: 19px; font-weight: 900; color: #fca5a5; }
      .danger-sub { font-size: 14px; color: #ffffff; font-weight: 700; margin-top: 3px; }
      .score-badge { width: 56px; height: 56px; border-radius: 50%; background: #ef4444; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.6); }
      .danger-desc { font-size: 14px; line-height: 1.55; color: #f8fafc; font-weight: 500; }

      .entity-card { background: #0f192f; border: 1.5px solid #334155; border-radius: 16px; padding: 16px 20px; }
      .entity-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .entity-name-row { display: flex; align-items: center; gap: 12px; }
      .entity-name { font-size: 21px; font-weight: 900; color: #ffffff; }
      .tro-badge { background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.6); color: #fca5a5; font-size: 12.5px; font-weight: 800; padding: 4px 10px; border-radius: 6px; }
      .similarity-tag { font-size: 15px; font-weight: 900; color: #38bdf8; }
      .entity-owner { font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 12px; }
      .law-alert { background: rgba(245, 158, 11, 0.16); border: 1.5px solid rgba(245, 158, 11, 0.5); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 800; color: #fde047; }
    </style></head><body>
      <div class="left-pane">
        <div class="brand-badge">
          <img class="brand-logo" src="${squircleIconB64}" />
          <span class="brand-name">DropGuard</span>
          <span class="tag-pill">${tag}</span>
        </div>
        <h1 class="hero-title">${heroTitle}</h1>
        <p class="hero-desc">${heroDesc}</p>
        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">🛡️</div>
            <div>
              <div class="feature-title">${isEn ? '1,200+ Cross-Border TRO Entity Database' : '1,200+ 跨国高危 TRO 品牌库'}</div>
              <div class="feature-sub">${isEn ? 'Aggressive law firms tracked (AMS, Sullivan & Worcester, Keith, GBC).' : '全量覆盖 AMS、GBC、Keith、Sullivan 等知名律所重点打击品牌。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">⚠️</div>
            <div>
              <div class="feature-title">${isEn ? 'Threat Index & Risk Scoring (0-100)' : '多维度威胁量化评级 (0-100)'}</div>
              <div class="feature-sub">${isEn ? 'Exact & fuzzy trademark similarity algorithms with risk categorization.' : '多维度精准排查已注册商标、外观专利及文字模糊匹配。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">⚡</div>
            <div>
              <div class="feature-title">${isEn ? '1-Click Product Page Analysis' : '独立站详情页一键无感扫描'}</div>
              <div class="feature-sub">${isEn ? 'Scan titles & keywords automatically on any active Shopify product.' : '自动提取当前浏览独立站商品的标题与关键词，无需手动复制。'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-container">
        <div class="card-header">
          <div class="card-header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span class="card-header-title">${isEn ? 'DropGuard Spy' : 'DropGuard 选品雷达'}</span>
            <span class="pro-pill">PRO</span>
          </div>
          <div class="quota-badge">⚡ ${isEn ? '3/3 Free Daily' : '3/3 今日免费'}</div>
        </div>

        <div class="card-tabs">
          <div class="tab-btn">${tab1}</div>
          <div class="tab-btn active">${tab2}</div>
          <div class="tab-btn">${tab3}</div>
        </div>

        <div class="card-body">
          <div class="search-wrapper">
            <div class="search-label">${isEn ? 'PRODUCT TITLE TO SCAN' : '待排查商品标题'}</div>
            <div class="search-bar">
              <span class="search-val">Pokemon Pikachu Soft Silicone Night Light</span>
              <div class="scan-btn">🔍 ${isEn ? 'Scan IP' : '排查侵权'}</div>
            </div>
          </div>

          <div class="danger-box">
            <div class="danger-top">
              <div class="danger-left">
                <div class="danger-icon-badge">🛡️</div>
                <div>
                  <div class="danger-title">${isEn ? 'CRITICAL RISK (DANGER)' : '极高侵权风险 (CRITICAL DANGER)'}</div>
                  <div class="danger-sub">${isEn ? 'Threat Index: 93 / 100 • Urgent Delist Recommended' : '侵权威胁指数: 93 / 100 • 建议立即下架'}</div>
                </div>
              </div>
              <div class="score-badge">93</div>
            </div>
            <div class="danger-desc">
              ${isEn
                ? 'Critical IP infringement risk detected! Matched 1 registered trademark/patent entity. Listing this item carries immediate risk of PayPal/Stripe account freezing or federal court TRO lawsuit.'
                : '检出极高侵权风险！命中 1 个已注册商标/版权实体。刊登或广告投放该商品存在 PayPal/Stripe 资产冻结及美国联邦法院 TRO 诉讼封店风险。'
              }
            </div>
          </div>

          <div class="entity-card">
            <div class="entity-header">
              <div class="entity-name-row">
                <span class="entity-name">Pokemon</span>
                <span class="tro-badge">${isEn ? 'EXTREME (HIGH-FREQUENCY TRO TARGET)' : '极高危 (高频跨国 TRO 目标)'}</span>
              </div>
              <span class="similarity-tag">${isEn ? '100% Similarity' : '100% 匹配相似度'}</span>
            </div>
            <div class="entity-owner">${isEn ? 'Rights Owner: Nintendo / The Pokémon Company • Character' : '权利人: Nintendo / The Pokémon Company • 娱乐动漫类目'}</div>
            <div class="law-alert">
              <span>⚠️</span>
              <span>${isEn ? 'Aggressively pursued by AMS and Sullivan & Worcester TROs.' : '重点维权律所: AMS 及 Sullivan & Worcester，TRO 诉讼冻结频次极高。'}</span>
            </div>
          </div>

          <div class="card-footer">
            <div class="card-footer-tip">
              <span>💡</span>
              <span>${isEn ? 'Tip: Use Supply Sourcing tab to find safe unbranded mold alternatives.' : '建议：针对该款商品，推荐一键使用货源 Tab 寻找无侵权私模代工款'}</span>
            </div>
            <div class="card-footer-btn">${isEn ? 'Find Safe &rarr;' : '寻安全款 &rarr;'}</div>
          </div>
        </div>
      </div>
    </body></html>`;
  }

  if (shotNum === 3) {
    // Shot 3: 1688 Sourcing & Profit Margin Finder
    const heroTitle = isEn
      ? `1688 Factory Sourcing &<br><span class="highlight-blue">Profit Margin Finder</span>`
      : `1688 源头工厂直达<br><span class="highlight-blue">& 真实毛利空间测算</span>`;
    const heroDesc = isEn
      ? `Cut out middlemen dropshippers. Uncover original manufacturer ex-works pricing, calculate true margins, and get direct 1688 deep links.`
      : `剔除海外中间商差价。直接对标国内 1688 原厂出厂价，自动测算广告保本 CPA 阈值与单件净利润空间。`;
    const tag = isEn ? `SUPPLY SOURCING` : `源头货源挖掘`;
    const tab1 = isEn ? `🏪 Store Insights` : `🏪 店铺洞察`;
    const tab2 = isEn ? `🎯 IP Radar` : `🎯 侵权雷达`;
    const tab3 = isEn ? `💰 Sourcing` : `💰 货源利润`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getBaseCss()}
      .search-wrapper { display: flex; flex-direction: column; gap: 8px; }
      .search-label { font-size: 13.5px; font-weight: 800; color: #e2e8f0; }
      .search-bar { display: flex; align-items: center; justify-content: space-between; background: #0f192f; border: 1.5px solid #334155; border-radius: 12px; padding: 10px 16px; }
      .search-val { font-size: 15.5px; font-weight: 700; color: #ffffff; }

      .price-row { display: flex; align-items: center; justify-content: space-between; background: #0f192f; border: 1.5px solid #1e293b; border-radius: 12px; padding: 12px 18px; }
      .price-val { font-size: 17px; font-weight: 900; color: #ffffff; }
      .price-tag { background: linear-gradient(135deg, #10b981, #06b6d4); color: #ffffff; font-size: 13px; font-weight: 800; padding: 6px 14px; border-radius: 8px; }

      .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .metric-card { background: #0f192f; border: 1.5px solid #233354; border-radius: 14px; padding: 14px 16px; }
      .metric-title { font-size: 13px; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
      .metric-num { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
      .metric-sub { font-size: 12.5px; color: #64748b; font-weight: 600; margin-top: 4px; }

      .margin-box { background: rgba(16, 185, 129, 0.12); border: 2px solid #10b981; border-radius: 16px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; }
      .margin-left-title { font-size: 16px; font-weight: 800; color: #ffffff; }
      .margin-left-sub { font-size: 13px; color: #cbd5e1; margin-top: 4px; }
      .margin-right-val { font-size: 32px; font-weight: 900; color: #34d399; }

      .action-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
      .btn-1688 { background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff; font-size: 15px; font-weight: 800; padding: 14px 0; border-radius: 12px; text-align: center; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35); display: flex; align-items: center; justify-content: center; gap: 8px; }
      .btn-taobao { background: rgba(239, 68, 68, 0.16); border: 1.5px solid rgba(239, 68, 68, 0.45); color: #fca5a5; font-size: 15px; font-weight: 800; padding: 14px 0; border-radius: 12px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; }
    </style></head><body>
      <div class="left-pane">
        <div class="brand-badge">
          <img class="brand-logo" src="${squircleIconB64}" />
          <span class="brand-name">DropGuard</span>
          <span class="tag-pill">${tag}</span>
        </div>
        <h1 class="hero-title">${heroTitle}</h1>
        <p class="hero-desc">${heroDesc}</p>
        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">🏭</div>
            <div>
              <div class="feature-title">${isEn ? 'Ex-Works Factory Cost Benchmark' : '原厂出厂底价智能评估'}</div>
              <div class="feature-sub">${isEn ? 'Calculates expected manufacturer base cost (~18%-28% of retail).' : '类目算法测算源头出厂成本（通常为售价 18%~28%）。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">📈</div>
            <div>
              <div class="feature-title">${isEn ? 'Breakeven Ad CPA Estimator' : 'Meta / TikTok 广告保本 CPA 测算'}</div>
              <div class="feature-sub">${isEn ? 'Know your maximum allowable ad spend cap for Meta & TikTok ads.' : '精准测算获客成本安全边界与保本 ROAS，避免盲目烧广告。'}</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-box" style="background: rgba(234, 88, 12, 0.2); color: #fb923c;">🛒</div>
            <div>
              <div class="feature-title">${isEn ? '1-Click Deep Factory Links' : '一键直达 1688 / 淘宝同款工厂'}</div>
              <div class="feature-sub">${isEn ? 'Instant direct search deep links to 1688, Taobao, and AliExpress.' : '自动去噪关键词与以图搜款，1秒对接源头供应链批发采购。'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-container">
        <div class="card-header">
          <div class="card-header-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span class="card-header-title">${isEn ? 'DropGuard Spy' : 'DropGuard 选品雷达'}</span>
            <span class="pro-pill">PRO</span>
          </div>
          <div class="quota-badge">⚡ ${isEn ? '3/3 Free Daily' : '3/3 今日免费'}</div>
        </div>

        <div class="card-tabs">
          <div class="tab-btn">${tab1}</div>
          <div class="tab-btn">${tab2}</div>
          <div class="tab-btn active">${tab3}</div>
        </div>

        <div class="card-body">
          <div class="search-wrapper">
            <div class="search-label">${isEn ? 'PRODUCT TITLE FOR SOURCING' : '商品标题（用于货源反查）'}</div>
            <div class="search-bar">
              <span class="search-val">Cyberpunk RGB LED Gaming Headphones with Mic</span>
            </div>
          </div>

          <div class="price-row">
            <div>
              <span style="font-size: 13.5px; color: #94a3b8;">${isEn ? 'Retail Price: ' : '独立站售价: '}</span>
              <span class="price-val">$79.99 USD</span>
            </div>
            <span class="price-tag">⚡ ${isEn ? 'Source & Margins' : '供应链反查'}</span>
          </div>

          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-title">🏭 ${isEn ? 'Factory Ex-Works Cost' : '预估源头出厂成本'}</div>
              <div class="metric-num" style="color: #38bdf8;">$14.40 - $22.40</div>
              <div class="metric-sub">~18%-28% of Retail Price</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">📈 ${isEn ? 'Breakeven Ad CPA Limit' : 'Meta/TikTok 广告保本 CPA'}</div>
              <div class="metric-num" style="color: #34d399;">$36.91</div>
              <div class="metric-sub">Max ROAS Threshold</div>
            </div>
          </div>

          <div class="margin-box">
            <div>
              <div class="margin-left-title">${isEn ? 'Gross Margin Space' : '单件净毛利空间'}</div>
              <div class="margin-left-sub">${isEn ? 'Est. Packet/Air Shipping: $4.80 USD • 24-48h Dispatch' : '国际跨境小包预估头程运费: $4.80 USD • 24-48h 出库'}</div>
            </div>
            <div class="margin-right-val">$56.79 (71%)</div>
          </div>

          <div class="action-grid">
            <div class="btn-1688">🛒 ${isEn ? '1688 Factory Direct' : '1688 源头货源直达'}</div>
            <div class="btn-taobao">📦 ${isEn ? 'Taobao Sourcing' : '淘宝同款反查'}</div>
          </div>
        </div>
      </div>
    </body></html>`;
  }
}

async function renderAll() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // NO artificial hinting
  });

  const languages = ['en', 'zh'];
  for (const lang of languages) {
    const dir = lang === 'en' ? enDir : zhDir;
    for (let shot = 1; shot <= 3; shot++) {
      const html = buildHtml(lang, shot);
      
      // 1. Render 2x Retina (2560x1600) - Ultimate Sharpness
      const page2x = await browser.newPage();
      await page2x.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
      await page2x.setContent(html, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 400));
      const p2x = path.join(dir, `screenshot_${shot}_2560x1600.png`);
      await page2x.screenshot({ path: p2x, type: 'png' });
      await page2x.close();
      console.log(`Rendered 2x: ${p2x}`);

      // 2. Render 1x (1280x800) - Clean 1:1, NO blur, NO ringing filter
      const page1x = await browser.newPage();
      await page1x.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page1x.setContent(html, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 400));
      const p1x = path.join(dir, `screenshot_${shot}_1280x800.png`);
      await page1x.screenshot({ path: p1x, type: 'png' });
      await page1x.close();
      console.log(`Rendered 1x: ${p1x}`);
    }
  }

  await browser.close();
  console.log('🎉 All assets rendered cleanly with zero artificial filters!');
}

renderAll();
