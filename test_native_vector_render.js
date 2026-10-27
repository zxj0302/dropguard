import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const squircleIconB64 = `data:image/png;base64,${fs.readFileSync('store_assets/icon_squircle.png').toString('base64')}`;

// Let's create a pure native vector-rendered showcase for IP Radar (ZH and EN)
const htmlZH = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
    body {
      width: 1280px;
      height: 800px;
      background: radial-gradient(circle at 75% 40%, #152033 0%, #090e1a 50%, #020617 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 48px;
      overflow: hidden;
      position: relative;
    }
    .ambient-glow {
      position: absolute;
      right: 180px;
      top: 100px;
      width: 500px;
      height: 600px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .left-pane {
      width: 560px;
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
      font-size: 36px;
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
      font-size: 16px;
      line-height: 1.6;
      color: #94a3b8;
      margin-bottom: 30px;
    }
    .features-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .feat-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 12px;
      padding: 13px 18px;
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
      font-size: 15px;
      font-weight: 800;
      color: #f1f5f9;
      margin-bottom: 3px;
    }
    .feat-info p {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* RIGHT PANE: PURE VECTOR HTML/CSS COMPONENT */
    .right-pane {
      width: 580px;
      z-index: 2;
    }
    .card-shell {
      background: rgba(10, 15, 28, 0.96);
      border: 1.5px solid rgba(56, 189, 248, 0.25);
      border-radius: 20px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9), 0 0 45px rgba(6, 182, 212, 0.2);
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
    .input-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .input-text {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
    }
    .scan-btn {
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .alert-banner {
      background: rgba(239, 68, 68, 0.12);
      border: 1.5px solid rgba(239, 68, 68, 0.4);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .alert-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .alert-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .alert-icon-hex {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
    }
    .alert-title {
      font-size: 18px;
      font-weight: 900;
      color: #f87171;
    }
    .alert-subtitle {
      font-size: 12px;
      color: #fca5a5;
      margin-top: 2px;
    }
    .score-circle {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 4px solid #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 900;
      color: #fff;
      background: rgba(239, 68, 68, 0.2);
    }
    .alert-desc {
      font-size: 12.5px;
      line-height: 1.55;
      color: #cbd5e1;
    }
    .matched-box {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
    }
    .matched-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .matched-term {
      font-size: 16px;
      font-weight: 900;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tro-badge {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #f87171;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .sim-rate {
      color: #38bdf8;
      font-size: 13px;
      font-weight: 800;
    }
    .matched-meta {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .matched-law {
      font-size: 11.5px;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.08);
      padding: 6px 10px;
      border-radius: 6px;
      margin-top: 6px;
    }
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: #090e1a;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="ambient-glow"></div>
  <div class="left-pane">
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
          <p>全量覆盖 AMS、Keith、GBC、Sullivan 等知名流氓律所重点打击品牌。</p>
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
  </div>

  <div class="right-pane">
    <div class="card-shell">
      <div class="card-topbar">
        <div class="card-app-title">
          <div class="card-app-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="card-app-name">
            DropGuard 选品雷达
            <span class="pro-badge">PRO</span>
          </div>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); padding: 3px 8px; border-radius: 9999px;">
          ⚡ 3/3 免费额度
        </div>
      </div>
      <div class="card-nav">
        <div class="nav-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
          店铺洞察
        </div>
        <div class="nav-btn active">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
          侵权雷达
        </div>
        <div class="nav-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          货源利润
        </div>
      </div>
      <div class="card-body">
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.5px;">待排查商品标题</div>
        <div class="input-box">
          <div class="input-text">Pokemon Pikachu Soft Silicone Night Light</div>
          <div class="scan-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            排查侵权
          </div>
        </div>

        <div class="alert-banner">
          <div class="alert-header">
            <div class="alert-title-wrap">
              <div class="alert-icon-hex">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div class="alert-title">极高侵权风险 (DANGER)</div>
                <div class="alert-subtitle">侵权威胁指数: 93 / 100</div>
              </div>
            </div>
            <div class="score-circle">93</div>
          </div>
          <div class="alert-desc">
            检出高危侵权风险！命中 1 个已注册商标/专利实体。刊登或广告投放该商品存在 PayPal/Stripe 资产冻结及美国联邦法院 TRO 诉讼风险。
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">命中侵权品牌与外观专利列表 (1)</div>
        <div class="matched-box">
          <div class="matched-header">
            <div class="matched-term">
              Pokemon
              <span class="tro-badge">极高危 (高频跨国 TRO 诉讼目标)</span>
            </div>
            <div class="sim-rate">100% 匹配相似度</div>
          </div>
          <div class="matched-meta">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><line x1="15" y1="22" x2="15" y2="22.01"/><line x1="9" y1="2" x2="9" y2="2.01"/><line x1="15" y1="2" x2="15" y2="2.01"/></svg>
            权利人: Nintendo / The Pokémon Company • 娱乐动漫类目
          </div>
          <div class="matched-law">
            ⚠️ 重点维权律所: AMS 及 Sullivan & Worcester，TRO 冻结诉讼频次极高。
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div>设备标识: e2679103-dd6a...</div>
        <div style="color: #38bdf8; font-weight: 700;">✨ 升级专业版 Pro ($29/月)</div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function test() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // Render at 2560x1600 (2x Retina scale), so text is 100% native vector sharp!
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.setContent(htmlZH, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));

    // Save as 1280x800 and 2x Retina
    await page.screenshot({ path: '/Users/zxj/.gemini/antigravity/brain/d0a14217-fd33-4400-9502-cea4193de480/native_vector_test_2x.png' });
    console.log('Saved native vector test!');
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
