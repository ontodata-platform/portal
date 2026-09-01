# 管理门户后端实施设计

日期：2026-08-27

状态：实施设计（本轮落地）

对照：`docs/superpowers/specs/2026-08-27-portal-productization-design.md`  
前端对照：`2026-08-27-portal-frontend-implementation.md`

## 1. 本轮范围

只改 `portal/backend`。不新建中心、不新建订阅/执行表、不改前端、不考虑 CI/CD。

交付：

- 当前主体解析 + `GET /api/v1/personal/me`
- 个人中心与写路径去掉调用方传入的身份权威
- 商城详情 / 申请 / 审批通过后投递订阅
- 工作台详情 / 代理 submit+start
- 上游受控 POST；写失败不得 200 降级

## 2. 相对总规格的补充

1. **DATA_GRANT 投递不自消费 Kafka。** 审批决定仍发 `portal.approval.decided` 给网关等外部订阅方。门户自己的投递用同步 Spring `@EventListener`：避免 approval-center ↔ aggregation-center 循环依赖，也避免测试环境无 Kafka。监听器吞掉投递异常，不回滚审批终态。无 `serviceId` 的历史审批单不投递。
2. **路径用稳定编码，订阅/运行用上游 id。** 目录展示 `code`；data-platform 订阅要 `serviceId`（UUID）；recombine 提交要 `templateId`。门面先按 keyword 查目录，精确匹配 `code`，取出 `id`（没有 `id` 则退回 `code`）。
3. **IAM 关闭固定 `dev-user`。** `OperatorContext` 为 null 时写入/查询都用 `dev-user`。请求体仍可带 `requester`/`decisionBy`，但必须等于当前主体，否则 400。集成测试里原来的 alice/carol 手填要改掉。
4. **读降级 vs 写失败。** 详情 GET 与目录一样：上游挂了返回 200 `available=false`。apply / runs / retry-delivery 返回 502，`code=UPSTREAM_FAILED`。
5. **不扩展错误 JSON 的 `retryable` 字段**（避免动统一错误协议）。502 即表示可重试。
6. **待我审仍是租户内全部 PENDING。** 本轮不引入审批人字段。

## 3. 身份

### 3.1 `CurrentOperator`（common）

- `DEV_USER = "dev-user"`
- `name()`：JWT `sub`，否则 `dev-user`
- `requireMatches(provided)`：provided 空白则忽略；否则必须等于 `name()`

### 3.2 `GET /api/v1/personal/me`

```json
{
  "name": "tester",
  "tenantId": "default",
  "orgId": null,
  "projectId": null,
  "roles": ["portal-admin"],
  "devMode": false
}
```

- IAM 关：`devMode=true`，`name=dev-user`，`roles=[]`（前端靠 devMode 展开全菜单）
- IAM 开：`devMode=false`；角色取 JWT `portal_roles`（字符串数组），没有则 `[]`
- 租户/组织/项目取 `TenantContext` / `PermissionContext`

### 3.3 个人中心

`GET /personal/requirements|approvals|todos` **删除** `requester` 参数，按 `CurrentOperator.name()` 过滤。

### 3.4 写路径

`CreateApprovalRequest.requester`、`DecideApprovalRequest.decisionBy`、`CreateRequirementRequest.requester` 改为可选。服务层写入 `CurrentOperator.name()`。

## 4. 上游客户端

`UpstreamHttpClient` 增加：

- `post(baseUrl, path, jsonBody, label) → JsonNode`
- 超时 5s，透传 `X-Tenant-Id`
- GET 失败语义不变（抛 `IllegalArgumentException`，目录/详情可降级）
- POST 失败抛 `UpstreamWriteException`（中文消息），由 `GlobalExceptionHandler` 映射 **502 `UPSTREAM_FAILED`**

## 5. 商城门面

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/marketplace/data-services/{code}` | 目录精确匹配；失败降级 |
| POST | `/api/v1/marketplace/data-services/{code}/apply` | 解析上游条目；创建 `DATA_GRANT`；`sourceSystem=data-platform`，`sourceCode=code` |
| POST | `/api/v1/marketplace/applications/{approvalCode}/retry-delivery` | 仅已通过且未成功投递 |

申请 `detail`：

```json
{
  "serviceCode": "dsv-12345678",
  "serviceId": "<上游 id 或 code>",
  "grantedColumns": [],
  "deliveryStatus": "PENDING"
}
```

通过后监听器调用 `POST {data-platform}/api/v1/data-service-subscriptions`，body `{ serviceId, consumer: 审批单 requester, grantedColumns }`。成功写 `subscriptionId` + `SUCCEEDED`；失败写 `FAILED` + `deliveryError`，**不回滚审批**。

## 6. 工作台门面

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/workbench/capabilities/{code}` | 读降级 |
| GET | `/api/v1/workbench/workflow-templates/{code}` | 读降级 |
| POST | `/api/v1/workbench/workflow-templates/{code}/runs` | 解析模板 id；`POST /api/v1/executions`；再 `POST /executions/{taskId}/start` |

运行响应：`{ taskId, status, started }`。submit 成功而 start 失败：仍 200，`started=false`，不二次 submit。submit 失败：502。

本轮不对普通运行强制审批。

## 7. 文件

| 动作 | 路径 |
| --- | --- |
| 新建 | `common/.../security/CurrentOperator.java` |
| 新建 | `common/.../api/UpstreamWriteException.java` |
| 新建 | `personal-center/.../api/PortalIdentityResponse.java` |
| 新建 | `approval-center/.../application/ApprovalDecidedApplicationEvent.java` |
| 新建 | `aggregation-center/.../application/DataGrantDeliveryListener.java` |
| 新建 | `aggregation-center/.../application/CatalogLookup.java` |
| 新建 | 申请/运行请求响应 DTO |
| 修改 | OperatorContext 注释、OidcClaimMapping（roles）、Personal*、Approval*、Requirement*、UpstreamHttpClient、Marketplace/Workbench、GlobalExceptionHandler |
| 修改 | 既有集成测试中的 requester 参数；新建门面集成测试 |

`aggregation-center` 增加对 `portal-approval-center` 的依赖（创建审批 + 回写 detail）。

## 8. 测试与验收

- `CurrentOperator` 单测：无认证 → `dev-user`；不匹配 → 异常
- `PortalIntegrationTest.personalCenter*`：不再传 requester；创建省略身份字段；主体为 `dev-user`
- `PortalIamIntegrationTest`：`/personal/me` 的 name=tester、devMode=false；个人查询隔离在 subject
- `PortalMarketplaceApplyIntegrationTest`：桩 data-platform；apply → decide → 订阅被调用；订阅 503 → FAILED → retry 成功
- `PortalWorkbenchRunIntegrationTest`：桩 recombine submit+start；上游 500 → 门户 502
- 既有聚合读/降级用例保持

命令：`mvn -pl server -am test`（在 `portal/backend`）。

验收对齐总规格 §12 的后端条目：身份不可偷看、申请出 `apr-*`、运行出 `taskId`、无新表。
