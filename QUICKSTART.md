# DropGuard 本地 5 分钟端到端联调指南 (Quickstart Guide)

欢迎使用 **DropGuard: Shopify & Ad Competitor Spy + IP Radar**。
本指南将引导您在 5 分钟内完成后端服务启动、前端扩展编译、Chrome 本地加载与实测验证。

---

## 🛠️ 环境准备

- **Node.js**: 18.0+ (推荐 20.x 或 22+)
- **包管理器**: npm
- **浏览器**: Google Chrome (支持 Manifest V3)

---

## 步骤 1：启动后端防御与配额引擎 (`/server`)

打开终端窗口，进入 `/server` 目录并启动 Hono API：

```bash
cd server
npm install
npm run dev
```

*看到如下日志即表示后端已就绪：*
```text
[DropGuard Server] Listening on http://localhost:8787
```

> **探活验证**：在浏览器或终端访问 `http://localhost:8787/health`，返回 `{"status":"ok"}` 即表示服务正常运行。

---

## 步骤 2：编译构建 Chrome 插件端 (`/extension`)

打开第二个终端窗口，进入 `/extension` 目录进行严格编译与 Terser 混淆打包：

```bash
cd extension
npm install
npm run build
```

*构建输出说明：*
- 编译产物自动生成至 `extension/dist/` 目录；
- 包含已混淆且无 source map 的单文件 `content.js`（Tailwind CSS 100% 编译并通过 `?inline` 封装）；
- 自动拷贝 `manifest.json` 与各尺寸图标。

---

## 步骤 3：在 Google Chrome 中加载已解压扩展程序

1. 在 Chrome 地址栏输入并打开：
   ```text
   chrome://extensions/
   ```
2. 在页面右上角开启 **“开发者模式” (Developer mode)** 开关；
3. 点击左上角的 **“加载已解压的扩展程序” (Load unpacked)** 按钮；
4. 在文件选择窗口中，选择项目下的 **`Chrome_Plugin/extension/dist`** 文件夹并点击确认；
5. 看到 **DropGuard: Shopify & Ad Competitor Spy + IP Radar** 出现在扩展列表中即安装成功！

---

## 步骤 4：在 Shopify 独立站进行实测验证

打开任意真实 Shopify 独立站（例如）：
- `https://www.allbirds.com`
- `https://www.gymshark.com`
- `https://colourpop.com`
- 或任意自建的 Shopify 开发商店

### 1. 悬浮球 (FAB) 自动挂载
- 页面加载完成后，Isolated World 探针自动侦测 Shopify 特征；
- 页面右下角将展示带有动态 Radar 旋转和“Shopify Live”绿灯标志的 DropGuard 悬浮球。

### 2. 打开业务抽屉 (Raycast Drawer)
- 点击悬浮球，右侧将滑出仿 Raycast 暗色现代抽屉面板。

### 3. 测试三大核心面板：
- **Tab 1: Store Insights**：
  - 查看当前店铺所用的模板名称（例如 Dawn / Impulse）；
  - 查看在售商品数量估算与货币符号；
  - 浏览公开新品监控流，点击任一商品的 `IP` 或 `Supply` 按钮可一键直达排查。
- **Tab 2: IP Radar**：
  - 输入带有高危词的测试标题（例如 `Disney Mickey PopSockets Phone Grip`）；
  - 点击“排查”，观察动态骨架屏载入后，仪表盘显示 **DANGER 威胁指数 96/100**，并精准列出迪士尼与 PopSockets 专利风险预警；
  - 输入普通标题（例如 `Bamboo Cutting Board`），显示 **SAFE 安全**。
- **Tab 3: Supply Sourcing**：
  - 输入商品零售价（例如 `$39.99`）；
  - 点击“供应链反查”，自动测算 18%~28% 源头出厂成本（$7.2 - $11.2）、单件毛利与保本广告 CPA 上限；
  - 点击 **1688 原厂** 或 **AliExpress** 按钮，直达货源深层搜索页面。

---

## 步骤 5：测试商业化 Paywall 配额锁死与重置

1. 连续进行 3 次排查或反查，观察右上角配额胶囊由 `⚡ 3/3 Free` 扣减为 `⚡ 0/3 Free`；
2. 发起第 4 次排查，后端立即返回 `HTTP 402 QUOTA_EXCEEDED`；
3. 前端面板无缝切入 **Paywall 锁死视图**，敏感数据模糊打码，并展示“升级 Pro ($29/月)”升级按钮；
4. 点击面板下方的 **“测试模式：重置今日免费配额”** 按钮，配额瞬间恢复，即可继续测试。

---

## 常见问题排查 (Troubleshooting)

- **Q: 悬浮球没有出现在网页上？**
  - 请确认打开的网站确为 Shopify 架构；
  - 打开浏览器控制台 (F12)，查看是否有 `[DropGuard] Shopify store confirmed!` 日志。
- **Q: 提示 Failed to connect to DropGuard Radar Server？**
  - 请确保后端终端保持运行在 `http://localhost:8787`。
- **Q: 更改了前端代码后如何刷新？**
  - 在 `/extension` 目录下重新运行 `npm run build`，并在 `chrome://extensions` 页面点击 DropGuard 卡片右下角的“刷新”按钮。

