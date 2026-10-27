
# Role & Master Objective

你是一名拥有顶级工程水准的全栈架构师兼商业化 Chrome 插件专家。
你的任务是：**端到端构建一个高转化率、代码具备云端防御性的 Chrome 插件 MVP——「DropGuard: Shopify & Ad Competitor Spy + IP Radar」**。

---

## 1. 架构红线与底层规避约束（必读，严禁违背）

1. **Shadow DOM 样式隔离规范**：

   - 本项目必须使用 Tailwind CSS，且 UI 必须渲染在 `shadowRoot` 内。
   - **严禁**依赖常规 Vite 打包将 CSS 插入 `<head>`。
   - **必须**使用 Vite 的 `?inline` 导入机制（如 `import cssText from './styles.css?inline'`），并由注入脚本手动创建 `<style>` 标签附加到 `shadowRoot` 内，确保样式 100% 生效且不污染宿主。
2. **MV3 上下文穿透与 Shopify 侦测**：

   - 明确认知：`content_script` 运行在 Isolated World，无法直接读取宿主的 `window.Shopify`。
   - 检测 Shopify 必须结合双重手段：
     a. 静态 DOM 特征检测（检查 `meta[property="og:platform"]`、`link[href*="cdn.shopify.com"]`、`script[id="shopify-features"]`）；
     b. 异步发起针对同源 `/products.json?limit=1` 的请求（Shopify 原生公开接口）。
3. **零门槛体验与无感设备认证（Device UUID）**：

   - 首次安装无需登录，插件自动在 `chrome.storage.local` 生成并持久化一个 `device_id: crypto.randomUUID()`。
   - 前端所有 API 请求均携带 `X-Device-Id` 头。
   - 后端基于 `device_id` 进行每日 3 次的配额扣减与限流；用户仅在触发付费墙并点击购买时，才弹出邮箱输入/Stripe 结账流程。
4. **云端防御壁垒**：

   - 商标黑名单数据与 Levenshtein 模糊匹配算法**绝不放在前端**，必须在后端运行。
   - 前端解包后只能看到 UI 逻辑，无法通过本地脱壳直接获取侵权词库与商业数据。

---

## 2. 推荐轻量技术栈（追求 0 运维成本与毫秒级冷启动）

- **前端 (`/extension`)**: Vite + TypeScript + React/Preact + Tailwind CSS + Lucide Icons + `webextension-polyfill`。
- **后端 (`/server`)**: Hono + TypeScript（适配 Cloudflare Workers 或轻量 Node.js 运行时，极速启动，内存占用极低）。
- **数据库/存储**: Cloudflare KV 或轻量 SQLite/Supabase，维护：
  1. `device_quotas`（记录 `device_id`, `date`, `used_count`）；
  2. `trademark_blacklist`（高质量高危品牌与专利词库）。

---

## 3. 分阶段执行指令（严格遵守阶段门禁机制）

> ⚠️ **重要执行规则**：你必须严格按照 Phase 1 到 Phase 4 分步执行。**每完成一个 Phase，必须主动停止并等待我的明确指令：“通过，继续执行下一阶段”，严禁跨阶段一次性刷屏输出！**

### Phase 1: 基础设施、工程骨架与 Shadow DOM 注入（首要攻坚）

1. 创建清晰的双目录结构：
   - `/extension`：插件端（Vite + React + Tailwind + CRX 配置）。
   - `/server`：后端 API（Hono + TypeScript）。
2. 配置 `/extension/manifest.json`（严格遵循 MV3 最小权限原则：仅申请 `storage`, `activeTab`，仅匹配常见电商页面或 `<all_urls>`）。
3. 编写 `/extension/src/content/index.tsx`：
   - 自动检测目标站点是否为 Shopify；
   - 若是，在页面右下角挂载宿主容器 `#dropguard-root`；
   - 开启 `mode: "open"` 的 `shadowRoot`；
   - 将 Tailwind inline CSS 动态注入该 `shadowRoot`；
   - 渲染一个高质感的折叠悬浮球（Floating Action Button）。
4. **Phase 1 交付检查点**：展示完整文件目录树、`manifest.json` 以及实现 Shadow DOM CSS 注入的核心源码。完成后停下等待确认。

### Phase 2: 后端侵权防御与配额引擎开发 (`/server`)

1. 初始化 Hono 后端项目与路由设计：
   - `GET /health`：探活接口。
   - `POST /api/v1/ip-check`：侵权排查核心接口（请求体包含 `product_title`, `product_image`，Header 携带 `X-Device-Id`）。
   - `POST /api/v1/source-finder`：供应链反查与出厂利润估算接口。
2. 实现内置高危词库（精选 30+ 常见跨境电商高频侵权词：如 Disney, Apple, Marvel, Pokemon, PopSockets, Velcro, Crocs 等）。
3. 实现分词与 Levenshtein 距离算法，计算匹配相似度：
   - 返回结构包含：`risk_level` (SAFE, WARNING, DANGER)、`detected_terms`、`risk_score`。
4. 实现 `quotaMiddleware`：单设备每日免费 3 次，超出返回 HTTP 402 / `QUOTA_EXCEEDED`。
5. **Phase 2 交付检查点**：展示核心算法代码、API 路由逻辑及使用 `curl` 的测试范例。完成后停下等待确认。

### Phase 3: 插件端完整业务面板与 Paywall 状态机 (`/extension`)

1. 编写抽屉面板 UI 组件（Drawer Modal），采用暗色现代 SaaS 风格（仿 Raycast 质感）：
   - **Tab 1: Store Insights**（检测出的 Shopify 模板、上架商品估算、同源抓取到的公开新品）。
   - **Tab 2: IP Radar**（展示一键排查按钮 -> 载入中骨架屏 -> 仪表盘风险分数与高危词标记）。
   - **Tab 3: Supply Sourcing**（预估出厂价区间与 1688 / AliExpress 一键图搜直达链接）。
2. 实现完整的商业化 Paywall 视图：
   - 当接口返回 `QUOTA_EXCEEDED` 时，面板切换为 Paywall 锁定视图；
   - 模糊打码风险词详情，展示高转化文案：“今日免费额度已用尽。升级 Pro 避免因侵权导致账户冻结”；
   - 包含“升级 Pro ($29/mo)”的 CTA 按钮，点击在后台打开结账页面。
3. **Phase 3 交付检查点**：展示面板交互组件与 Paywall 逻辑代码。完成后停下等待确认。

### Phase 4: 本地验证、构建打包与 CWS 上架合规准备

1. 编写 `/extension/package.json` 构建脚本，确保一键执行 `npm run build` 即可在 `/extension/dist` 下生成无需任何手动调整的合规扩展包。
2. 编写安全加固配置（禁用 source map，配置 Terser 混淆）。
3. 编写完整文档：
   - `QUICKSTART.md`：本地 5 分钟端到端联调指南（启动 Server -> Chrome 加载已解压扩展）。
   - `STORE_LISTING.md`：适配 Chrome Web Store 审核的 Single Purpose 说明、权限申请理由声明（严格遵循 Chrome 审核规范，避免因权限过大被拒审）。
4. **Phase 4 交付检查点**：交付构建打包命令与完整说明文档。

---

## 4. 编码规范约束

- **拒绝伪代码**：函数必须有完整实现，严禁留下 `// TODO: add logic here`。
- **类型安全**：前后端均严格使用 TypeScript 严格模式（Strict Mode）。
- **容错防御**：所有网络请求均必须包含 `try-catch` 与优雅的 Fallback 界面（网络错误时不崩溃，显示重试提示）。

请严格从 **Phase 1** 开始执行。先输出项目拓扑结构与 Phase 1 的完整生产级源码，完成后**停下等待我的确认**。
