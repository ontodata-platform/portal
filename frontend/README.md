# ontodata 管理门户前端（portal-ui）

管理门户用户界面：统一任务中心、审批中心、结果中心、需求管理与门户运营（对齐门户设计 Task 1+2 与总体设计 §5）。

## 技术栈（与 data-platform/ui 同基线）

- Vue 3.5 + TypeScript 5.8 + Vite 7 + Ant Design Vue 4 + Pinia 3 + axios + vue-router 4；
- 测试：Vitest 3 + @vue/test-utils + jsdom；类型：vue-tsc（strict）；规范：ESLint 9（flat config，max-warnings=0）。

## 页面（与后端五大中心一一对应）

| 路由 | 页面 | 后端（端口 18085） |
| --- | --- | --- |
| `/operations` | 门户运营：统计卡 + 公告（发布/归档）+ 反馈（处理） | operations-center |
| `/tasks` | 统一任务中心：状态/来源/类型过滤 + 详情 | task-center |
| `/approvals` | 审批中心：创建 + 通过/拒绝（终态防重提示） | approval-center |
| `/results` | 结果中心：登记（路径强约束来源）+ 详情 | result-center |
| `/requirements` | 需求管理：登记 + 分析/分派/启动/完成/取消流转 | requirement-center |

## 本地开发

```bash
pnpm install
pnpm dev        # http://localhost:5175，/api 代理到 http://localhost:18085
pnpm test       # Vitest（编码契约/客户端/消息 store/视图）
pnpm build      # vue-tsc 类型检查 + 产物构建
pnpm lint       # ESLint（max-warnings=0）
```

## 约定

- 稳定编码契约（apr-/req-/ntc-/fb-）在 `src/types/contracts.test.ts` 与后端生成器逐一对齐；
- 错误一律经 `ApiError` 归一为中文提示，traceId 用于后端日志对账；
- 任务/审批/结果均为聚合展示与引导，不建立第二权威（总体设计 §5 边界）。
