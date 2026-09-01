# M5 产品化：多租户基础（请求级租户上下文与隔离）

日期：2026-08-15

状态：设计记录（M5 多租户第一项落地——task-center/approval-center 参考实现后，
其余中心全部同构完成：result/requirement/operations/personal/aggregation/retention）

仓库：`wpp/ontodata/portal`

## 1. 目标

租户数据完全隔离（M5：两租户完全隔离验收），为租户×组织×项目×数据密级的 ABAC
打底；IAM 对接后租户来自认证上下文，接口形状不变。

## 2. 设计

- `TenantContext`（common）：请求级 ThreadLocal 租户上下文，缺省 `default`；
- `TenantContextFilter`（common，Order(1)）：读 `X-Tenant-Id` 请求头装载上下文 +
  MDC（日志按租户检索）；非法格式（非 `[a-z0-9-]{1,64}`）拒绝 400；
- 参考实现（task-center / approval-center）：
  - 写入：实体构造接收租户（`TenantContext.current()`）；
  - 查询：`findByTaskIdAndTenantId` / `findByCodeAndTenantId`（跨租户 404），
    列表加租户谓词；
  - 幂等键含租户维度：同一 taskId 在不同租户各自独立副本；
- 其余中心同构（同一模式逐中心落地）：
  - result-center：`(tenant_id, source_system, result_id)` 复合唯一，
    `findBySourceSystemAndResultIdAndTenantId`，列表加租户谓词；
  - requirement-center：`(tenant_id, code)` 复合唯一（实体唯一约束从 code 列
    迁移到表级），`findByCodeAndTenantId`，去重查询 `findFirstBy…AndTenantId…`
    限定本租户（跨租户同标题互不阻塞，同租户去重 409 不变）；
  - operations-center：公告/反馈 `(tenant_id, code)` 复合唯一、
    `findByCodeAndTenantId`；运营统计 `countByTenantId` /
    `countByStatusAndTenantId` 按租户统计；
  - personal-center：我的需求/我的申请/待办统计全部加租户谓词（跨租户看不到
    他人租户的待办与清单）；
  - aggregation-center：`UpstreamHttpClient` 透传 `X-Tenant-Id` 请求头，
    租户上下文贯通门户 → 各软件正式 REST 契约（数据商城/算法工作台目录查询）；
  - retention-center：`count/deleteTerminalOlderThan` 增加 tenantId 条件，
    清理只作用于本租户终态数据。

设计要点：

- **唯一约束必须与服务层查询维度一致**：服务层租户化后，自然键唯一约束全部改为
  `(tenant_id, …)` 复合，避免租户间相互阻塞与通过 409 探测其他租户数据存在性；
- **状态机/终态防重语义不随租户改变**：同租户内原有不变量（进度只增、终态防重
  409、同标题去重）原样保留，租户只是切分维度；
- 实体 `@Column(unique = true)` 全部改为表级 `@UniqueConstraint(tenant_id, …)`，
  与 Flyway 迁移一致（迁移是唯一 schema 权威）。

## 3. 验收

- 端到端（独立 H2）：tenant-a 数据对 tenant-b 不可见（列表 0、find 404）、
  同 taskId/结果标识/需求标题各租户独立登记（幂等键含租户维度）、
  同租户内去重仍 409、运营统计与个人中心待办按租户隔离、
  缺省头 = default、非法租户 400；
- 聚合链路（JDK HttpServer 桩）：`X-Tenant-Id` 随门户聚合调用透传到上游软件，
  缺省透传 `default`。

## 4. 后续（M5 多租户其余项）

- ABAC（租户×组织×项目×数据密级）策略引擎；
- IAM 对接（OIDC/LDAP/国产身份）后租户从认证上下文解析；
- 跨租户数据迁移与配额。
