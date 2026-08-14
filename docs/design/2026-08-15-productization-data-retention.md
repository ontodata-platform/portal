# M5 产品化：数据保留与归档删除（Data Retention）

日期：2026-08-15

状态：设计记录（M5 数据保留项落地，代码与测试已交付）

仓库：`wpp/ontodata/portal`

## 1. 目标

超过保留期的终态记录按策略清理，控制数据增长；同时保证**非终态数据与证据链
（结果引用，可追踪率 100%）永不清理**（总体设计 M5：数据保留归档删除）。

## 2. 设计

- 配置 `ontodata.retention.days`（默认 180）：截点 = 当前时刻 - 保留天数。
- 清理对象（门户本地五类，仅终态）：
  | 对象 | 终态 |
  | --- | --- |
  | 任务聚合副本 | SUCCESS/FAILED/CANCELED |
  | 审批单 | APPROVED/REJECTED |
  | 需求单 | COMPLETED/CANCELED |
  | 反馈 | HANDLED |
  | 公告 | ARCHIVED |
- **不清理**：非终态记录（PENDING/RUNNING/OPEN/ANALYZING/ASSIGNED/IN_PROGRESS/DRAFT/PUBLISHED）
  与结果中心结果引用（证据链保留，归档另策）。
- 接口（retention-center）：
  - `GET /api/v1/retention/status`：保留天数、截点与五类可清理统计；
  - `POST /api/v1/retention/cleanup?dryRun=true|false`：dryRun 只统计不删除
    （先演练后执行，审计安全）。

## 3. 验收

- 端到端（独立 H2，retention.days=0）：五类终态统计 ≥1 → dryRun 数据仍在 →
  真实清理后五类终态为 0 → **非终态审批与结果引用保留**。

## 4. 后续

- 各业务软件同构落地本策略（data-platform/transform/recombine 的审计与终态表）；
- 归档（冷存储/对象存储转移）与恢复演练；
- 定时调度（Spring @Scheduled/外部调度器）与清理审计日志。
