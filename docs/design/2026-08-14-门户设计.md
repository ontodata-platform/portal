# 管理门户落地方案设计（M4）

日期：2026-08-14

状态：设计稿，供评审（对齐《统一业务平台总体设计说明》§5）

修订：2026-08-17 按 WP-02/03/07 实现现状修订（字段更名、事件驱动投影、审批决定事件化、IAM 缺省开启）

仓库：`wpp/ontodata/portal`

## 1. 定位与边界

管理门户是用户入口：组织权限界面、需求管理、数据商城、算法工作台、统一任务中心、审批中心、智能助手、结果中心。门户**只聚合展示与引导**：任务权威归产生它的软件（总体设计 §12.3 权威表），门户通过事件订阅更新聚合副本（可由事件流重放重建）；审批不替代业务软件的确认链路，R4 工具审批与 MCP 确认卡联动；模型只做规划与解释。

## 2. 模块划分（M4 Task 1 首版）

```text
portal/backend/
├─ common/           # 分页、错误协议、请求追踪（与各软件同构移植）
├─ task-center/      # 统一任务中心：各软件任务事件驱动投影（Kafka 消费 + Inbox 幂等，可重放重建）
├─ approval-center/  # 审批中心：审批流骨架（apr-* 审批单，终态防重，决定发布 portal.approval.decided 事件）
├─ result-center/    # 结果中心：结果引用登记（资源引用+元数据，对象走对象存储）
└─ server/           # 启动与装配（端口 18085；IAM 缺省开启，默认即安全）
```

## 3. 核心设计

### 3.1 统一任务中心（总体设计 §12.3）

- 任务投影：`taskId/taskType/sourceSystem/parentTaskId/status/stage/progress/resourceRefs/resultRefs/traceId/eventVersion/lastEventId/updatedAt`（WP-03 起 `ownerSystem` 更名 `sourceSystem`，对齐契约 task/v1；`eventVersion`/`lastEventId` 记录最近一次已应用事件，供乱序防护与对账）。
- 投影来源以**事件订阅为主**（WP-03）：Kafka 消费者订阅源系统任务事件，Inbox 按 `(consumer_id, event_id)` 去重、`aggregateVersion` 乱序防护（只应用版本更大的事件），进度只增不回退；投影可经 `POST /api/v1/projections/rebuild` 由一次性消费组从事件流整体重放重建。
- `PUT /api/v1/tasks/{taskId}` 回调式幂等 upsert 为过渡兼容路径（**Deprecated**，事件链路稳定后随 ADR-006 弃用边界下线）；幂等性由自然键 `(tenant_id, task_id)` 唯一约束与"进度只增不回退"不变量保证。
- 父任务只聚合子任务状态；门户不产生任务。

### 3.2 审批中心

- 审批单 `apr-*`：PENDING → APPROVED/REJECTED，终态不可重复审批。
- 审批决定**事件优先**（WP-07）：决策落定同事务经 Outbox 发布 `portal.approval.decided`（主题 `ontodata.portal.approval.v1`），源系统订阅事件拿结果；按编码轮询回查（`GET /approvals/{code}`）仅作降级兼容路径。
- 审批类型与 MCP 工具风险分级联动（R4 确认卡可升级为审批单，联调任务）。

### 3.3 结果中心

- 结果引用登记：resultId（源软件生成）+ 资源引用 + 元数据；大对象走对象存储，门户只存引用。
- 可追踪率 100%（总体设计 §13.4）：每个结果必须带来源系统与结果标识。

## 4. 验收（M4 Task 1）

1. 任务事件投影幂等（重复/乱序事件不产生脏数据，Inbox 去重 + 版本裁决），按状态/来源过滤，可由事件流重放重建。
2. 审批单终态防重（重复审批 409），决策落定发布 `portal.approval.decided` 事件。
3. 结果登记与查询，缺来源信息拒绝登记。

## 5. 风险

| 风险 | 应对 |
| --- | --- |
| 任务双权威 | 门户投影可由事件流整体重放重建（`POST /api/v1/projections/rebuild`），冲突时以源软件为准（按 aggregateVersion 版本裁决收敛） |
| 审批链路与 MCP 确认叠加 | 审批类型与工具风险分级映射表单一维护 |
