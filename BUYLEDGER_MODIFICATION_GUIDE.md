# 巴尔坦杂货铺 · 改动约束指南

## 项目信息
- **路径**: `/opt/buy-ledger/`
- **服务**: `node server.js`，端口 `4020`
- **数据**: `data.db`（SQLite via sql.js）
- **前端**: `public/index.html`（单文件 SPA）
- **后端**: `server.js`（单文件 Express）

---

## 区域标记说明

| 标记 | 含义 |
|------|------|
| ❌ No-Go Zone | 核心结构，动则崩溃 |
| ⚠️ Caution Zone | 高风险，需完整测试 |
| ✅ Safe Zone | 常规改动范围 |

---

## ❌ No-Go Zone

### `data.db` 数据库文件
- SQLite 文件，直接改会损坏数据
- 如需修改 schema，只能通过 `server.js` 执行 `db.run()` 迁移

### `initDB()` 函数中的 Schema 定义（约 L27~62）
- `toys` / `supplies` / `supply_logs` / `shipping_rules` / `settings` 表结构
- **不能改字段名、字段类型、默认值**
- 只能加新字段，且必须向后兼容

### `saveDB()` 函数
- 将内存数据库写回 `data.db` 的唯一出口
- 改动可能导致数据丢失

### 前端 `public/index.html` 中的 `initDB()` / `renderHome()` / `renderStockList()` / `renderSoldList()` 核心渲染函数
- 状态管理依赖全局变量 `toys`, `supplies`, `rules`, `categories`
- 改动前必须确认变量引用链不断

---

## ⚠️ Caution Zone

### `server.js` API 路由结构
- toys/supplies/shipping_rules 的 CRUD 路由顺序和参数格式
- `PUT /api/toys/:id` 的字段列表必须和前端 Form 对应
- 新增字段要同时改前端 Form 和后端路由

### 前端 `public/index.html` 的 Modal 弹窗逻辑
- `sell-modal`、`after-modal`、`restock-modal` 等弹窗的表单字段
- `confirmSell()` / `confirmPartial()` / `confirmReturn()` 等提交逻辑
- 改动后必须测试完整流程（进货→售出→发货→完成/退款）

### `/api/shipping/calculate` 计价逻辑
- 关联 ZTO 快递分区规则
- 改动后需验证各区域计价

---

## ✅ Safe Zone

### 前端 UI 样式（CSS）
- 颜色变量（`--accent`、`--green` 等）
- 卡片、按钮、布局样式
- 不影响数据逻辑

### `server.js` 中的 `app.get('/api/stats')` 统计口径
- 只影响首页统计数字展示
- 改动后对照 toys 状态核验

### 新增 API endpoint
- 可以在 `server.js` 底部（`app.listen` 之前）添加新路由
- 前端通过 `get()` / `post()` / `put()` / `del()` 工具函数调用

### `shipping_rules` / `supplies` / `settings` 的增删改
- 已有完整的 CRUD API
- 前端已有对应 UI

---

## 改动流程

1. **改前**：读本文件，确认区域
2. **改后**：更新 `BUYLEDGER_WORK_LOG.md`
3. **部署**：`PUT /api/upload-index` 上传前端，或直接替换 `server.js` 后 `kill` 重启进程
4. **回归测试**：进货→展示→售出→完成 完整链路走一遍

## 保活说明

当前进程用 `nohup node server.js &` 拉起，系统重启后会断。
如需保活，应配置 systemd service。
