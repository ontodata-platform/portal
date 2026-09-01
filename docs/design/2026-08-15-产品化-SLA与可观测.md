# M5 产品化：SLA 度量与可观测性（第一项：上游依赖健康）

日期：2026-08-15

状态：设计记录（M5 SLA 度量第一项落地，代码与测试已交付）

仓库：`wpp/ontodata/portal`

## 1. 目标

业务 API 可用性月度 ≥ 99.5%（非功能基线 §13.4）需要可度量的健康面：门户
`/actuator/health` 携带三大上游软件（管理平台/算法转换工具/算法重组平台）的健康详情，
SLO 度量与告警按 details 聚合判断。

## 2. 设计

- `UpstreamHealthIndicator`（aggregation-center）：探活上游 `/actuator/health`（200=UP，
  失败=DOWN + 中文原因）；
- 语义：门户整体恒 UP（降级基线——模型故障/上游不可用不阻断核心页面 API），
  details 暴露 `data-platform/algorithm-transform/algorithm-recombine` 三键；
- 复用 `UpstreamHttpClient`（5s 超时、中文错误归一）。

## 3. 验收

- 单测 2 例：全 UP；上游 DOWN 时门户仍 UP 且 DOWN 详情携带中文原因。

## 4. 后续（M5 SLA 其余项）

- 各软件同构暴露依赖健康；Prometheus/OpenTelemetry 指标导出与告警规则；
- SLO 探针（P95 只读 < 2s、写提交 < 1s、可用性 99.5%）纳入 CI 门禁；
- 压测门禁与容量季度复核（M6）。
