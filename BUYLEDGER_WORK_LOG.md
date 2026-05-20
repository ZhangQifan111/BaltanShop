# 巴尔坦杂货铺 · 工作日志

## 2026-05-15 22:30 — 巴尔坦（图片上传功能开发）

### 完成功能
- **新增图片上传功能**：进货表单可选上传图片，弹出确认弹窗展示图片预览+表单数据，用户确认后入库
- **补图入口**：库存/已售列表每条记录旁显示 📷 图标（无图时）或缩略图（有图时），点击可上传/替换图片
- **后端改动**：
  - toys 表新增 `toy_image_path` 列（ALTER TABLE 向后兼容）
  - 新增 `POST /api/upload-toy-image/:id`（multer 文件上传）
  - 新增 `DELETE /api/toy-image/:id`（删除图片）
  - PUT `/api/toys/:id` 支持 `toy_image_path` 字段
- **关键 Bug Fix**：原 `server.js` 中 `app.use()` catch-all fallback 写在 API 路由之前，导致所有请求包括 PUT /api/... 被拦截返回 HTML。已重构路由顺序：所有 API 路由 → static files → fallback

### 推送
- commit b7c5227 — feat: 图片上传功能 -进货表单支持上传图片+确认弹窗入库

### 待测试
- [ ] 浏览器实际测试完整流程（上传图片→确认弹窗→入库→列表显示缩略图）
- [ ] 补图功能测试

---

## 2026-05-15 21:55 — 巴尔坦（接手维护）

### 项目现状
- **技术栈**: Node.js + Express + sql.js（内存 SQLite）+ 单文件 SPA
- **服务状态**: 进程在 `nohup` 下运行（系统重启后会断）
- **数据**: `data.db`（SQLite），内存数据库，重启后从文件加载
- **代码状态**: `public/index.html` 有未提交改动
- **当前数据**: 2件库存（巴尔坦三轮车、奥特曼手偶）

### 已知问题
1. 服务进程无 systemd 管理，重启后会丢
2. `public/index.html` 有 git modified 未提交

### 摸底清单
- [x] `server.js` 全量阅读（405行）
- [x] `public/index.html` 全量阅读（825行）
- [x] 数据库 schema 确认（toys/supplies/supply_logs/shipping_rules/settings）
- [x] API 端点清单确认
- [x] 前端页面结构确认（首页进货/发货/库存 tab、耗材页、设置页）
- [ ] systemd service 尚未配置

### 待办
- [ ] 配置 systemd service 保活
- [ ] 提交 `public/index.html` 的 git 修改

---

## 2026-05-20 10:47 — 巴尔坦（买入价估算功能）

### 完成功能
- **买入价估算器**：按品类×箱规定义费用规则，输入咸鱼售价+目标利润率，反推最高买入价
- **数据库改动**：
  - 新建 `fee_rules` 表（品类/箱规/手续费%/日本运费/国际运费/税费/国内运费/箱费/包装费/默认利润率）
  - `settings` 表新增 `default_profit_margin` 配置项
- **后端 API**:
  - `GET /api/fee-rules` — 查所有规则
  - `POST /api/fee-rules` — 新增规则
  - `PUT /api/fee-rules/:id` — 更新规则
  - `DELETE /api/fee-rules/:id` — 删除规则
  - `POST /api/calc-buy-price` — 买入价估算
  - `GET /api/categories` — 查品类列表（含箱规选项）
  - `GET /api/box-sizes` — 查箱规列表
- **前端**：
  - 新增「费用规则」页面（规则管理）
  - 新增「买入价估算器」页面（计算器）
  - 新增商品时费用字段自动填入对应规则值

### 部署
- server.js 重启（kill -9 458360 然后 nohup node server.js &）
- 规则值需用户自行配置

### 待办
- [ ] 配置 systemd service
- [ ] 浏览器完整测试流程
