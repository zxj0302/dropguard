# Chrome Web Store (CWS) 上架申请与合规声明指南 (Store Listing Package)

本文档专为 **Google Chrome Web Store (CWS) 开发者控制台** 提交审核编写，严格遵循 Google 的 **Single Purpose Policy（单一用途政策）** 与 **Limited Use Policy（最小权限与数据隐私原则）**，以确保顺利通过审核。

---

## 1. 基础 Listing 信息 (Store Metadata)

- **扩展名称 (Extension Title)**:
  `DropGuard: Shopify & IP Infringement Radar`
  *(不超过 45 个字符)*

- **简短描述 (Short Description)**:
  `Detect Shopify store insights, uncover trademark IP risks, and estimate factory sourcing margins in one click.`
  *(不超过 132 个字符)*

- **主分类 (Category)**:
  `Productivity` 或 `Shopping`

- **适用语言 (Languages)**:
  English (United States), 中文 (简体)

---

## 2. 详细功能说明 (Detailed Description)

```text
DropGuard is an essential e-commerce intelligence assistant built specifically for dropshippers, DTC brand owners, and Shopify merchants.

Protect your business against costly trademark lawsuits (TROs) while analyzing competitor storefronts with surgical precision:

🛡️ Real-Time IP Infringement Radar
• Scan any product title against 35+ high-risk trademark, patent, and character databases (Disney, Apple, Marvel, PopSockets, Crocs, and more).
• Fuzzy Levenshtein pattern matching uncovers deceptive copycat variations that could freeze your PayPal/Stripe account or trigger Illinois federal court statutory damages.
• Instant threat gauge and risk classification (SAFE, WARNING, DANGER).

🏬 Shopify Store Competitor Insights
• Automatically detect Shopify storefronts and reverse-engineer active theme templates (Dawn, Impulse, Prestige, etc.).
• Estimate catalog size and inspect freshly dropped product releases in real time.
• Effortlessly pivot any catalog item into IP defense or sourcing analysis.

🏭 1-Click Supply Chain & Margin Spy
• Calculate realistic factory ex-works unit cost brackets (18%-28% of retail).
• Model estimated gross margins and maximum recommended Meta/TikTok ad spend (breakeven CPA).
• Direct one-click deep links to 1688 (factory direct sourcing) and AliExpress (global dropship fulfillment).

🔒 Privacy First & Zero Intrusiveness:
DropGuard executes its user interface inside an isolated Shadow DOM container to prevent host website style interference. We do not require personal login credentials to get started and never harvest or sell your personal browsing history.
```

---

## 3. 单一用途声明 (Single Purpose Justification)

**Google 审核问卷问题**：*Explain how your extension fulfills a single, cohesive purpose.*

> **官方回复范本 (Official Justification)**:
> "DropGuard has a single, narrow purpose: providing e-commerce intelligence and intellectual property trademark risk assessments for merchants browsing Shopify storefronts. All features—including Shopify theme inspection, title trademark checks, and factory cost estimation—strictly serve this single objective of assisting merchants in evaluating product viability and legal compliance."

---

## 4. 权限申请理由声明 (Permission Justifications)

根据 Chrome Web Store 审核规范，对于 `manifest.json` 中声明的每一项权限，必须提供精确且不可替代的业务理由：

### 4.1 `storage` 权限
- **声明理由 (Declaration)**:
  `Required to store an anonymous, randomized device identifier (UUID) generated locally via crypto.randomUUID(), which allows the extension to track the user's daily free scanning quota without requiring personal registration or third-party tracking cookies. It also stores user UI preferences locally.`

### 4.2 `activeTab` 权限
- **声明理由 (Declaration)**:
  `Required to read the title and price of the product currently displayed on the active Shopify storefront tab when the user explicitly triggers a threat scan or sourcing calculation.`

### 4.3 `host_permissions (<all_urls>)` 权限
- **声明理由 (Declaration)**:
  `Independent Shopify merchants host their storefronts on hundreds of thousands of arbitrary, custom top-level domain names worldwide (e.g., allbirds.com, gymshark.com, colourpop.com) rather than standard *.myshopify.com subdomains. Because Shopify stores do not belong to a static or predictable list of domains, <all_urls> is strictly necessary for the content script to execute lightweight client-side heuristics (checking for CDN asset patterns and Shopify metadata). On non-Shopify domains, the extension remains completely inactive and performs no DOM modification.`

---

## 5. 用户数据隐私声明 (User Data Privacy Compliance)

在 CWS 开发者中心 “Privacy practices” 标签页中按如下标准进行声明：

1. **是否收集个人身份信息 (Personally Identifiable Information)?**
   - **否 (No)**：不收集姓名、物理地址、电子邮箱、手机号或身份证件。
2. **是否收集健康信息、金融信息或凭据?**
   - **否 (No)**。
3. **数据使用保证 (Data Usage Policy)**:
   - 勾选：`Does not sell or transfer user data to third parties outside of the approved use cases.`
   - 勾选：`Does not use or transfer user data for determining creditworthiness or for lending purposes.`
   - 勾选：`Does not use or transfer user data to serve personalized, re-targeted, or interest-based advertising.`

---

## 6. 上架材料准备清单 (Submission Checklist)

- [x] 16x16 图标 (`extension/public/icons/icon16.png`)
- [x] 48x48 图标 (`extension/public/icons/icon48.png`)
- [x] 128x128 图标 (`extension/public/icons/icon128.png`)
- [x] 经过 Terser 混淆且无 source map 的打包产物 (`extension/dist/`)
- [x] 符合 Manifest V3 最小权限规范的 `manifest.json`
- [x] 完整的 Single Purpose 与权限用途说明（见本文档）

