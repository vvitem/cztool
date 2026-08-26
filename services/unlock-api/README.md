# CZTool Unlock API（对接 EdgeKey）

独立 Cloudflare Worker，与 [EdgeKey](https://github.com/34892002/edgeKey) **共用同一个 D1 数据库**：

- **发码 / 卖码**：在 EdgeKey 后台创建商品、导入或自动发货卡密（`Card` 表）
- **解锁 / 绑机**：本 Worker 校验卡密、一码一机、签发 24 小时会话

## 架构

```
用户购买 → EdgeKey 发货 Card (status=SOLD)
                ↓
CZTool 输入卡密 → POST /verify → 读 Card 表 + 写 cztool_unlock_binding
                ↓
24h 内免输 → 本地 session；过期可 /refresh 或重新输入同一卡密续期
```

## 前置条件

1. 已部署 EdgeKey，并记下 D1 的 `database_id`（与 `edgekey-db` 相同）
2. 在 EdgeKey 创建「CZTool 激活码」类商品，导入或销售卡密

## 部署步骤

### 1. 初始化绑定表（在 EdgeKey 的 D1 上执行一次）

```bash
cd services/unlock-api
npm install

# 把 wrangler.toml 里的 database_id 换成你的 EdgeKey D1 UUID

# 本地联调
npm run db:migrate:local

# 生产
npm run db:migrate:remote
```

### 2. 配置密钥并部署

```bash
npx wrangler secret put TOKEN_SECRET
# 输入随机长字符串（与 EdgeKey 的 AUTH_SECRET 无关，专用于解锁 token 签名）

npm run deploy
```

部署成功后得到 URL，例如：`https://cztool-unlock-api.<account>.workers.dev`

### 3. 可选：限制商品

在 `wrangler.toml` 的 `[vars]` 中设置：

```toml
CZTOOL_PRODUCT_ID = "3"   # EdgeKey 后台商品 ID，只接受该商品的卡密
```

### 4. 配置 CZTool 客户端

项目根目录 `.env`：

```env
VITE_UNLOCK_API_URL=https://cztool-unlock-api.<account>.workers.dev
```

打包前确保该变量写入构建；开发默认 `http://127.0.0.1:8787`。

开发跳过解锁（仅未打包时）：

```bash
CZTOOL_UNLOCK_SKIP=1 npm run dev
```

## API

### `GET /health`

健康检查。

### `POST /verify`

```json
{ "code": "XXXX-XXXX", "deviceId": "<sha256>", "appVersion": "28.2.0" }
```

成功：`{ "ok": true, "token": "...", "expiresAt": 1735200000000 }`

错误：`{ "error": "验证码无效" }`（400/403）

### `POST /refresh`

```json
{ "deviceId": "<sha256>", "token": "<previous-token>" }
```

成功：新的 `token` 与 `expiresAt`（再延长 24h）。

## 卡密状态说明

| EdgeKey Card.status | 是否可解锁 |
|---|---|
| `SOLD` | 是（已发货，买家使用） |
| `UNUSED` | 是（管理员手动发码、未走订单时可测） |
| `LOCKED` | 否 |
| `DISABLED` | 否 |

## 本地联调

```bash
# 终端 1：EdgeKey 本地（如已部署）
# 终端 2：unlock-api
cd services/unlock-api
npm run dev

# 终端 3：CZTool
VITE_UNLOCK_API_URL=http://127.0.0.1:8787 npm run dev
```

在 EdgeKey D1 本地库插入测试卡密后，用 CZTool 验证。

## 生成测试卡密（EdgeKey 后台）

1. 登录 `https://<your-edgekey>/admin`
2. 商品管理 → 创建商品 → 卡密自动发货
3. 卡密管理 → 批量导入，例如 `TEST-0001`
4. 将卡密状态设为已售（或保持 UNUSED 用于测试）

## 表结构

本 Worker 仅新增表 `cztool_unlock_binding`，**不修改** EdgeKey 原有表。
