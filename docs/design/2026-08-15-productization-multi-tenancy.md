# M5 产品化：多租户基础（请求级租户上下文与隔离）

日期：2026-08-15

状态：设计记录（M5 多租户第一项落地——参考实现 task-center/approval-center，
其余中心同构落地）

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
- 数据保留（M5）同步租户隔离：`count/deleteTerminalOlderThan` 增加 tenantId 条件。

## 3. 验收

- 端到端（独立 H2）：tenant-a 数据对 tenant-b 不可见（列表 0、find 404）、
  同 taskId 各租户独立 upsert、缺省头 = default、非法租户 400。

## 4. 后续（M5 多租户其余项）

- 其余中心（result/requirement/operations/personal/aggregation）同构落地；
- ABAC（租户×组织×项目×数据密级）策略引擎；IAM 对接（OIDC/LDAP/国产身份）后
  租户从认证上下文解析；跨租户数据迁移与配额。
