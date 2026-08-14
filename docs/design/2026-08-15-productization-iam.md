# M5 产品化：IAM 对接基础（OIDC Bearer JWT → 请求级上下文）

日期：2026-08-15

状态：设计记录（M5 IAM 第一项落地——resource server 认证 + claim 映射，
属性开关默认关闭；浏览器登录流程与客户端凭据服务间调用后续轮次）

仓库：`wpp/ontodata/portal`

## 1. 目标

统一身份（OIDC）接入后，租户/组织/项目/许可密级不再来自显式请求头，而是从令牌
claim 映射——多租户与 ABAC 的调用方接口形状不变（`TenantContext`/`PermissionContext`
继续是唯一读取入口）。LDAP/国产身份系统经 IdP（如 Keycloak）OIDC 桥接统一，平台侧
不直接对接 LDAP。

## 2. 设计

### 2.1 双模式（属性开关）

`ontodata.security.oauth2.enabled`（缺省 false）：

- **false（显式头模式，开发/演示）**：现状行为——`TenantContextFilter` 从
  `X-Tenant-Id` 等请求头装载上下文；生产严禁；
- **true（IAM 模式）**：`SecurityConfiguration.secureChain` 启用 stateless JWT
  resource server（`/actuator/health`、`/actuator/info` 放行，其余端点必须携带令牌）；
  `ClaimContextFilter`（Order(10)，运行在 Security 链 -100 之后）从令牌 claim
  装载上下文并**覆盖**请求头装载值——显式头被忽略（claims 优先），防止头冒充身份。

### 2.2 claim 约定（与 IdP 声明协议一致）

| claim | 平台属性 | 规则 |
| --- | --- | --- |
| `tenant_id` | 租户 | 必填；缺失/非法 → 403（不可信身份） |
| `org_id` | 组织 | 可选；非法值按未提供处理 |
| `project_id` | 项目 | 可选；非法值按未提供处理 |
| `clearance` | 许可密级 | 可选；缺省 INTERNAL；非法值按缺省处理（失败安全，不因 claim 异常放权） |

映射为纯函数 `OidcClaimMapping.from(Authentication)`（单测覆盖）；当前支持 Jwt 主体
（resource server），OidcUser 主体（浏览器登录）后续接入，映射函数形状不变。

### 2.3 JWT 解码

`spring.security.oauth2.resourceserver.jwt.issuer-uri` 指向 IdP JWK 集；启用 IAM
未配置时启动即报错（拒绝半配置运行）。测试提供桩 `JwtDecoder`（身份由
spring-security-test 的 `jwt()` 后处理器注入，解码器不被调用）。

### 2.4 后续（IAM 其余项）

- 浏览器登录（authorization code + PKCE）：前端 SPA 骨架已落地（`VITE_IAM_ENABLED`
  门控 + `/login`/`/auth/callback` + 会话存储 + Bearer 附加，见 frontend
  `src/auth/oidc.ts`），待 IdP 部署后联调启用（生产必须 HTTPS）；
- 服务间调用客户端凭据（client-credentials）：MCP 网关 → 门户已落地
  （`mcp-gateway` 仓库 `2026-08-15-productization-iam-service-credentials.md`，
  Bearer 令牌 + fail-closed）；其余服务间调用按同构模式接入；
- IdP 选型与 claim 协议固化；令牌撤销/过期与密钥轮换演练；
- 各软件后端按 portal 同构接入（模式与代码同构移植）。
