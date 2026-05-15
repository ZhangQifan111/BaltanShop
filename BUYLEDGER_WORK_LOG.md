# 巴尔坦杂货铺 · 工作日志

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

## 历史记录

（更多历史记录待补）
