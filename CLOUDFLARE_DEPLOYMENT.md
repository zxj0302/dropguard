# DropGuard Cloudflare Workers 极简部署指南 (3分钟完成)

DropGuard 服务端已完成对 **Cloudflare Workers + Cloudflare KV** 的原生适配，支持 **全球 300+ 边缘机房 0ms 冷启动** 与 **永久持久化防丢单**。

---

## 前置准备

1. **注册 Cloudflare 账号**：[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)（完全免费，无需绑定信用卡）。
2. 在终端登录 Cloudflare（一键打开浏览器授权）：
   ```bash
   cd server
   npx wrangler login
   ```

---

## 快速部署流程

### 第一步：创建 Cloudflare KV 命名空间（持久化存储）

在 `server/` 目录下运行（注意是空格 `kv namespace create`）：
```bash
npx wrangler kv namespace create DROP_GUARD_KV
```
命令输出示例：
```
🌀 Creating namespace with title "dropguard-api-DROP_GUARD_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "DROP_GUARD_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

将输出中的 `id` 复制，填入 `server/wrangler.toml` 中的 `id`：
```toml
[[kv_namespaces]]
binding = "DROP_GUARD_KV"
id = "你的KV_ID填在这里"
```

*(可选：创建用于本地预览测试的 preview KV)*
```bash
npx wrangler kv namespace create DROP_GUARD_KV --preview
```

---

### 第二步：配置环境变量或密钥（如启用 Stripe 真实支付）

如果接入 Stripe 生产收款，使用 Wrangler 安全密钥管理设置：
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```
*提示：如果仅在开发测试阶段，无需配置密钥，系统会自动开启安全模拟支付模式。*

---

### 第三步：一键发布到全球边缘网络

在 `server/` 目录下执行：
```bash
npm run deploy
```
或者在项目根目录下执行：
```bash
npm run deploy:server
```

部署完成后，终端会输出你的专属 API 域名，例如：
```
Published dropguard-api (0.85 sec)
  https://dropguard-api.<你的账号前缀>.workers.dev
```

---

### 第四步：打包 Chrome 插件以对接新的 Cloudflare 域名

将插件中的 API 地址指向你的 Cloudflare Worker 域名并打包：
```bash
VITE_API_BASE_URL=https://dropguard-api.<你的账号前缀>.workers.dev npm run package
```
打包后生成的 `dropguard-extension-v1.0.0.zip` 即为最终提交 Chrome 应用商店的生产安装包！

---

## 本地极速模拟测试（可选）

本地模拟运行 Cloudflare 边缘环境：
```bash
cd server
npm run preview
```
服务将在 `http://localhost:8787` 启动，并自动模拟 KV 存储。
