# M5 产品化：ABAC 属性访问控制基础（租户×组织×项目×数据密级）

日期：2026-08-15

状态：设计记录（M5 ABAC 第一项落地——请求级四维上下文 + 数据密级策略，
结果中心首个强制点）

仓库：`wpp/ontodata/portal`

## 1. 目标

在多租户隔离之上建立属性访问控制（ABAC）：主体属性（租户、组织、项目、许可密级）
对资源属性（租户、数据密级）的访问判定，密级不足明确拒绝；为 IAM 对接后把属性
来源从请求头切换到认证上下文预留同一接口形状。

## 2. 设计

### 2.1 请求级上下文（common）

- `PermissionContext`：ThreadLocal 主体属性——组织（`X-Org-Id`）、项目
  （`X-Project-Id`）、许可密级（`X-Clearance-Level`）；
- `TenantContextFilter`（Order(1)）在租户之外同步装载四维上下文并校验：
  - 租户/组织/项目：`[a-z0-9-]{1,64}`，组织与项目可选（缺省空）；
  - 许可密级：PUBLIC/INTERNAL/CONFIDENTIAL/SECRET，缺省 INTERNAL
    （不无脑放宽到最低等级）；
  - 非法值 400 VALIDATION_FAILED（IAM 接入后由认证上下文解析，接口形状不变）。

### 2.2 数据密级（common/security）

- `DataClassification` 枚举：PUBLIC(0) < INTERNAL(1) < CONFIDENTIAL(2) <
  SECRET(3)，`rank()` 用于比较；字符串解析严格限定四种取值，非法抛中文
  IllegalArgumentException（归一 400）。

### 2.3 策略引擎（common/security/AbacPolicyEngine）

无状态纯函数组件，主体/资源属性由调用方提取传入（便于单元测试与策略演进）。
当前策略（M5 首版，代码内策略 + 中文注释；策略外置与策略管理后续落地）：

1. **租户隔离是前提**：资源租户 ≠ 主体租户直接拒绝（跨租户不可见，404 语义由
   查询层先行保证，引擎再兜底）；
2. **密级比较**：主体许可密级 ≥ 资源密级才允许；
3. **组织/项目维度**：资源侧尚未携带组织/项目属性（数据目录与任务组织属性后续
   接入），引擎形状已按四维设计，资源属性补齐后策略直接扩展，不改调用方。

### 2.4 强制点（result-center 首个）

- `portal_result.data_classification` 列（VARCHAR(32)，缺省 PUBLIC）；
- 登记：请求可选 `classification`，非法值 400；幂等更新时密级随最新登记同步；
- 详情：租户内查得后按引擎判定，许可不足 403（明确拒绝，不伪装 404）；
- 列表：只返回许可密级可见的行（`classification IN 可见等级`），不泄露高密级
  数据的存在性。

## 3. 验收

- 端到端（独立 H2）：
  - 缺省许可 INTERNAL：列表只见 PUBLIC，CONFIDENTIAL 详情 403；
  - 高许可 SECRET：两条均可见，详情 200；
  - 租户隔离优先于密级：跨租户即使 SECRET 也 404；
  - 非法许可头 / 非法登记密级 / 非法组织与项目头 400。

## 4. 后续（M5 ABAC 其余项）

- 其余中心（task/approval/requirement/operations）按资源属性接入强制点；
- 资源侧组织/项目属性（数据目录、任务组织归属）补齐后启用第三维策略；
- 策略外置（配置化管理）与策略审计日志；
- IAM 对接（OIDC/LDAP/国产身份）后主体属性改从认证上下文解析。
