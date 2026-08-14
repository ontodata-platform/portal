# 管理门户业务模块落地方案设计（M4 Task 2）

日期：2026-08-14

状态：设计稿，供评审（对齐《统一业务平台总体设计说明》§5.1 与管理门户技术要求）

仓库：`wpp/ontodata/portal`

## 1. 定位与边界

门户业务模块分两类，边界不同：

- **门户本地权威**：需求单（req-*）、公告（ntc-*）、反馈（fb-*）。这些是门户自己的业务对象，门户负责接收、流程与内容；执行仍归对应业务软件。
- **纯聚合展示**：数据商城、算法工作台、个人中心、审批管理界面。门户只经各软件正式 REST 契约读取与跳转，不建立第二权威；待 MCP/契约联调阶段接真实目录。

本轮（Task 2）实现需求管理（requirement-center）与门户运营（operations-center）两个本地权威模块；数据商城/算法工作台/个人中心随联调与前端工作块落地。

## 2. 模块划分（Task 2）

```text
portal/backend/
├─ common/             # 已有（Task 1）
├─ task-center/        # 已有（Task 1）
├─ approval-center/    # 已有（Task 1）
├─ result-center/      # 已有（Task 1）
├─ requirement-center/ # 需求管理：需求单 req-*（接收/去重/分析/分派/计划/关闭）
├─ operations-center/  # 门户运营：公告 ntc-*、反馈 fb-*、运营统计
└─ server/             # 装配（端口 18085）
```

## 3. 核心设计

### 3.1 需求管理（总体设计 §5 需求管理）

- 需求类型：DATA（数据需求）/ ALGORITHM（算法需求）/ COMPREHENSIVE（综合需求）。
- 状态机：OPEN → ANALYZING → ASSIGNED → IN_PROGRESS → COMPLETED；OPEN/ANALYZING 可 CANCELED；终态（COMPLETED/CANCELED）不可再流转（409）。
- 去重：同 (requirementType, 归一化标题) 存在非终态需求单时，新登记返回 409（DEDUPLICATED），
  引导用户合并；服务端归一化标题（去空白、转小写）。
- 分派：assigneeSystem 只能是平台内业务软件（data-platform/algorithm-transform/
  algorithm-recombine/ontology-platform/mcp-gateway），可附 assigneeRef（目标软件任务/对象编码）；
  门户只登记分派，不替目标软件执行。
- 计划：planJson 记录里程碑/预计交付/负责人（原样存储）；完成时 closedNote 必填。

### 3.2 门户运营（总体设计 §5 门户运营）

- 公告 ntc-*：title/content/section（栏目）/status（DRAFT→PUBLISHED→ARCHIVED 单向）、
  publishedAt；列表按栏目与状态过滤，DRAFT 不对外部公开查询可见（仅管理查询带 status）。
- 反馈 fb-*：PENDING → HANDLED，终态防重（重复处理 409），handleNote 必填。
- 运营统计：公告总数/已发布数、反馈待处理数（单次聚合查询，无跨库依赖）。

## 4. 验收（M4 Task 2）

1. 需求单全生命周期：登记 → 分析 → 分派 → 进行中 → 完成；终态再流转 409；同标题非终态重复登记 409；按类型/状态过滤。
2. 公告发布/归档单向流转与栏目过滤；反馈待处理 → 已处理，重复处理 409。
3. 运营统计数字与登记数据一致。

## 5. 风险

| 风险 | 应对 |
| --- | --- |
| 需求双权威 | 需求单归门户；分派后目标软件以其任务为权威，assigneeRef 仅引用不复制 |
| 去重误伤 | 去重只拦非终态同标题同类型；用户可以完成旧单后再提新单，或改标题；后续版本接向量相似度 |
