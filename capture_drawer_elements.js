import puppeteer from 'puppeteer-core';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const extDistPath = path.resolve('extension/dist');
const drawerDir = path.resolve('store_assets/drawers');
if (!fs.existsSync(drawerDir)) fs.mkdirSync(drawerDir, { recursive: true });

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
    }
  ]
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/products.json')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(mockProducts));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html><html><head><meta property="og:platform" content="Shopify"><meta name="shopify-digital-wallet" content="true"><script id="shopify-features">{"features":true}</script></head><body><h1>Shopify Store</h1></body></html>`);
});

server.listen(4569, async () => {
  console.log('Capture server running on port 4569');
  try {
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,900'],
      defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 2 }
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    async function setupLang(lang) {
      await page.goto('http://localhost:4569', { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 400));
      await page.evaluate((targetLang) => {
        window.chrome = window.chrome || {};
        window.chrome.storage = {
          local: {
            get: async () => ({ dropguard_lang: targetLang }),
            set: async () => {}
          }
        };
        window.chrome.runtime = { onMessage: { addListener: () => {} } };
      }, lang);

      await page.addScriptTag({ path: path.join(extDistPath, 'content.js') });
      await page.waitForSelector('#dropguard-root', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 600));

      await page.evaluate((targetLang) => {
        const host = document.getElementById('dropguard-root');
        const shadow = host?.shadowRoot;
        const btn = shadow?.querySelector('button');
        btn?.click();

        setTimeout(() => {
          const backdrop = shadow?.querySelector('div.fixed.inset-0.bg-slate-950\\/40');
          if (backdrop) backdrop.style.display = 'none';

          const langBtn = shadow?.querySelector('button[title*="中文"], button[title*="English"]');
          if (targetLang === 'zh' && langBtn && langBtn.textContent.includes('中文')) {
            langBtn.click();
          } else if (targetLang === 'en' && langBtn && langBtn.textContent.includes('English')) {
            langBtn.click();
          }
        }, 200);
      }, lang);
      await new Promise(r => setTimeout(r, 1200));
    }

    async function captureDrawerElement(filename) {
      const hostHandle = await page.$('#dropguard-root');
      const shadowRoot = await hostHandle.evaluateHandle(el => el.shadowRoot);
      const drawerHandle = await shadowRoot.evaluateHandle(sr => sr.querySelector('div.relative.z-10'));
      await drawerHandle.asElement().screenshot({ path: path.join(drawerDir, filename), omitBackground: true });
      console.log(`Saved drawer: ${filename}`);
    }

    // 1. English Drawers
    await setupLang('en');
    await new Promise(r => setTimeout(r, 1500));
    await captureDrawerElement('en_drawer_insights.png');

    // Click IP on Pikachu and wait for score ring to appear
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const ipBtns = shadow.querySelectorAll('button.border-rose-500\\/30');
      if (ipBtns[1]) ipBtns[1].click();
    });
    // Wait until the skeleton loading disappears and risk score appears
    await page.waitForFunction(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      return shadow && !shadow.querySelector('div.animate-pulse') && (shadow.textContent.includes('CRITICAL RISK') || shadow.textContent.includes('极高侵权风险'));
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
    await captureDrawerElement('en_drawer_radar.png');

    // Sourcing on Headphones
    await setupLang('en');
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const supplyBtns = shadow.querySelectorAll('button.border-cyan-500\\/30');
      if (supplyBtns[0]) supplyBtns[0].click();
    });
    await page.waitForFunction(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      return shadow && !shadow.querySelector('div.animate-pulse') && (shadow.textContent.includes('Gross Margin') || shadow.textContent.includes('单件毛利空间'));
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
    await captureDrawerElement('en_drawer_sourcing.png');

    // 2. Chinese Drawers
    await setupLang('zh');
    await new Promise(r => setTimeout(r, 1500));
    await captureDrawerElement('zh_drawer_insights.png');

    // Click IP on Pikachu
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const ipBtns = shadow.querySelectorAll('button.border-rose-500\\/30');
      if (ipBtns[1]) ipBtns[1].click();
    });
    await page.waitForFunction(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      return shadow && !shadow.querySelector('div.animate-pulse') && (shadow.textContent.includes('极高侵权风险') || shadow.textContent.includes('CRITICAL RISK'));
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
    await captureDrawerElement('zh_drawer_radar.png');

    // Sourcing on Headphones
    await setupLang('zh');
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      const supplyBtns = shadow.querySelectorAll('button.border-cyan-500\\/30');
      if (supplyBtns[0]) supplyBtns[0].click();
    });
    await page.waitForFunction(() => {
      const host = document.getElementById('dropguard-root');
      const shadow = host?.shadowRoot;
      return shadow && !shadow.querySelector('div.animate-pulse') && (shadow.textContent.includes('单件毛利空间') || shadow.textContent.includes('Gross Margin'));
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
    await captureDrawerElement('zh_drawer_sourcing.png');

    console.log('All 6 standalone drawers captured successfully!');
    await browser.close();
  } catch (err) {
    console.error('Drawer capture error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
