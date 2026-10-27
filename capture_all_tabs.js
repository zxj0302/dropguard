import puppeteer from 'puppeteer-core';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const extDistPath = path.resolve('extension/dist');
const rawScreenshotsDir = path.resolve('store_assets/raw');
if (!fs.existsSync(rawScreenshotsDir)) {
  fs.mkdirSync(rawScreenshotsDir, { recursive: true });
}

const mockProducts = {
  products: [
    {
      id: 791024501,
      title: "Cyberpunk RGB LED Gaming Headphones with Mic",
      handle: "cyberpunk-rgb-gaming-headphones",
      vendor: "ApexAudio",
      product_type: "Electronics",
      published_at: "2026-10-25T12:00:00Z",
      images: [
        { src: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80" }
      ],
      variants: [
        { price: "79.99", compare_at_price: "129.99" }
      ]
    },
    {
      id: 791024502,
      title: "Pokemon Pikachu Soft Silicone Night Light",
      handle: "pokemon-pikachu-silicone-night-light",
      vendor: "AnimeGlow",
      product_type: "Home Decor",
      published_at: "2026-10-24T08:30:00Z",
      images: [
        { src: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=600&auto=format&fit=crop&q=80" }
      ],
      variants: [
        { price: "24.99", compare_at_price: "39.99" }
      ]
    },
    {
      id: 791024503,
      title: "Ultra-Light Carbon Running Shoes Pro X9",
      handle: "carbon-running-shoes-pro",
      vendor: "VelocitySport",
      product_type: "Footwear",
      published_at: "2026-10-23T14:15:00Z",
      images: [
        { src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80" }
      ],
      variants: [
        { price: "119.00", compare_at_price: "160.00" }
      ]
    },
    {
      id: 791024504,
      title: "Minimalist Matte Black Stainless Tumbler 750ml",
      handle: "matte-black-stainless-tumbler",
      vendor: "HydraFlask",
      product_type: "Drinkware",
      published_at: "2026-10-22T09:00:00Z",
      images: [
        { src: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80" }
      ],
      variants: [
        { price: "28.50", compare_at_price: "35.00" }
      ]
    }
  ]
};

const htmlContent = `<!DOCTYPE html>
<html lang="en" class="shopify-theme-dawn">
<head>
  <meta charset="utf-8">
  <title>AuraStore - Modern Lifestyle & Tech</title>
  <meta property="og:platform" content="Shopify">
  <meta name="shopify-digital-wallet" content="true">
  <link rel="stylesheet" href="https://cdn.shopify.com/s/files/1/0000/0001/t/1/assets/dawn-theme.css">
  <script id="shopify-features" type="application/json">{"features":true}</script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #f8fafc; color: #0f172a; min-height: 100vh; }
    header { background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 16px 40px; display: flex; align-items: center; justify-content: space-between; }
    .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; color: #0f172a; }
    .badge { font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 9999px; font-weight: 600; }
    .hero { padding: 32px 40px; max-width: 1400px; margin: 0 auto; }
    .hero h1 { font-size: 28px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.5px; }
    .hero p { color: #64748b; font-size: 15px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .card img { width: 100%; height: 180px; object-fit: cover; }
    .card-body { padding: 14px; }
    .card-title { font-size: 13px; font-weight: 600; line-height: 1.4; margin-bottom: 8px; height: 38px; overflow: hidden; }
    .card-price { font-size: 15px; font-weight: 700; color: #0f172a; }
    .compare-price { font-size: 12px; color: #94a3b8; text-decoration: line-through; margin-left: 6px; }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
      AuraStore <span class="badge">Verified Shopify Store</span>
    </div>
    <div style="font-size: 13px; font-weight: 500; color: #64748b;">Theme: Dawn (Official)</div>
  </header>
  <div class="hero">
    <h1>Trending Direct-to-Consumer Catalog</h1>
    <p>Browse high-velocity dropshipping products, analyze store metrics and margins in real-time.</p>
    <div class="grid">
      ${mockProducts.products.map(p => `
        <div class="card">
          <img src="${p.images[0].src}" alt="${p.title}" />
          <div class="card-body">
            <div class="card-title">${p.title}</div>
            <div>
              <span class="card-price">$${p.variants[0].price}</span>
              <span class="compare-price">$${p.variants[0].compare_at_price}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/products.json')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(mockProducts));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(htmlContent);
});

server.listen(4567, async () => {
  console.log('Mock Shopify server running on http://localhost:4567');
  try {
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1440,900'
      ],
      defaultViewport: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 2
      }
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    async function initPageWithLang(targetLang) {
      await page.goto('http://localhost:4567', { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 600));

      await page.evaluate((lang) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: async (key) => ({ dropguard_lang: lang, [key]: lang }),
            set: async () => {},
          }
        };
        window.chrome.runtime = {
          onMessage: { addListener: () => {} }
        };
      }, targetLang);

      await page.addScriptTag({ path: path.join(extDistPath, 'content.js') });
      await page.waitForSelector('#dropguard-root', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 600));

      // Open drawer
      await page.evaluate((targetLang) => {
        const host = document.getElementById('dropguard-root');
        const shadow = host?.shadowRoot;
        const btn = shadow?.querySelector('button');
        btn?.click();

        // Check if language toggle is needed
        setTimeout(() => {
          const langBtn = shadow?.querySelector('button[title*="中文"], button[title*="English"]');
          if (targetLang === 'zh' && langBtn && langBtn.textContent.includes('中文')) {
            langBtn.click();
          } else if (targetLang === 'en' && langBtn && langBtn.textContent.includes('English')) {
            langBtn.click();
          }
        }, 300);
      }, targetLang);
      await new Promise(r => setTimeout(r, 1500));
    }

    async function capture(outFileName) {
      await page.screenshot({ path: path.join(rawScreenshotsDir, outFileName) });
      console.log(`Saved: ${outFileName}`);
    }

    // ==========================================
    // 1. ENGLISH SUITE
    // ==========================================
    console.log('--- Capturing English Suite ---');
    await initPageWithLang('en');
    await new Promise(r => setTimeout(r, 1500));
    await capture('en_tab1_insights.png');

    // Click IP on Pikachu product (row 1)
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const ipBtns = shadow.querySelectorAll('button.border-rose-500\\/30');
      if (ipBtns[1]) {
        ipBtns[1].click();
      }
    });
    await new Promise(r => setTimeout(r, 3500)); // wait for API
    await capture('en_tab2_radar.png');

    // Go back to insights or click supply on headphones
    await initPageWithLang('en');
    await new Promise(r => setTimeout(r, 1500));
    // Click Supply on Headphones (row 0)
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const supplyBtns = shadow.querySelectorAll('button.border-cyan-500\\/30');
      if (supplyBtns[0]) {
        supplyBtns[0].click();
      }
    });
    await new Promise(r => setTimeout(r, 3500)); // wait for API
    await capture('en_tab3_sourcing.png');

    // ==========================================
    // 2. CHINESE SUITE
    // ==========================================
    console.log('--- Capturing Chinese Suite ---');
    await initPageWithLang('zh');
    await new Promise(r => setTimeout(r, 1500));
    await capture('zh_tab1_insights.png');

    // Click IP on Pikachu product (row 1)
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const ipBtns = shadow.querySelectorAll('button.border-rose-500\\/30');
      if (ipBtns[1]) {
        ipBtns[1].click();
      }
    });
    await new Promise(r => setTimeout(r, 3500));
    await capture('zh_tab2_radar.png');

    // Reload with zh for Sourcing
    await initPageWithLang('zh');
    await new Promise(r => setTimeout(r, 1500));
    // Click Supply on Headphones (row 0)
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const supplyBtns = shadow.querySelectorAll('button.border-cyan-500\\/30');
      if (supplyBtns[0]) {
        supplyBtns[0].click();
      }
    });
    await new Promise(r => setTimeout(r, 3500));
    await capture('zh_tab3_sourcing.png');

    console.log('All 6 high-resolution native screenshots captured successfully!');
    await browser.close();
  } catch (err) {
    console.error('Capture suite failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
