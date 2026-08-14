# ontodata 管理门户（portal）

用户入口子系统：组织权限界面、需求管理、数据商城、算法工作台、统一任务中心、审批中心、智能助手、结果中心。对齐《统一业务平台总体设计说明》§5。

## 定位与边界

- **职责**：六个基础模块（Identity/Organization、Navigation、Task Center、Approval Center、AI Assistant、Result Center）+ 业务模块（需求管理、数据商城、算法工作台、个人中心、审批管理、门户运营、集成运维）。
- **不负责**：任何确定性执行与业务规则；任务权威归产生它的软件（§12.3），门户只聚合展示；模型只做规划与解释，降级路径（普通搜索/页面操作/人工办理）始终可用。
- **对外契约**：消费各软件 REST/事件契约（任务模型 §12.3、事件信封）；不产生新契约。

## 技术栈（ADR-001）

- 后端：Java 21 LTS、Spring Boot 3.3.x、Spring Security 6（jakarta）、Spring Data JPA + Flyway 10、MySQL 8.0+。
- 前端：Vue 3.5 + TypeScript + Vite 7 + Ant Design Vue 4（与 data-platform/ui 同基线）。

## 仓库结构（M4 首版）

```text
portal/
├─ docs/              # 设计文档
├─ backend/
│  ├─ common/         # 分页、错误协议、请求追踪（与各软件同构移植）
│  ├─ task-center/    # 统一任务中心（聚合副本，taskId 幂等 upsert）
│  ├─ approval-center/# 审批中心（apr-* 审批单，终态防重）
│  ├─ result-center/  # 结果中心（结果引用登记）
│  ├─ requirement-center/ # 需求管理（req-* 需求单，接收/去重/分派/关闭）
│  ├─ operations-center/  # 门户运营（ntc-* 公告、fb-* 反馈、运营统计）
│  ├─ aggregation-center/ # 数据商城/算法工作台聚合（各软件正式 REST 契约，降级展示）
│  ├─ personal-center/ # 个人中心（我的需求/我的申请/待办聚合，身份 M5 接 IAM）
│  └─ server/         # 启动与装配（端口 18085）
└─ frontend/          # Vue 3 管理门户界面（端口 5175，五中心页面）
```

设计详见 `docs/design/2026-08-14-portal-design.md`。

## 约定

- 测试先行、中文 Conventional Commit、Google Java Format（Spotless）、非显然逻辑中文注释。
- 任何"跨层直连"（直查数据源、直读本体草稿）一律拒绝；结果可追踪率 100%。
