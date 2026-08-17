package com.runisys.ontodata.portal.taskcenter.application;

/**
 * 一次事件投影更新（应用层内部值对象）：由统一事件信封映射而来，与传输层（Kafka/JSON）解耦， 使监听器的核心逻辑可被直接单测（测试不必起 broker）。
 *
 * @param eventVersion 信封 aggregateVersion 解析结果；为空表示事件未携带可解析的聚合版本 （仍按"最新事件覆盖"投影，但不参与乱序防护）
 */
public record TaskProjectionUpdate(
    String eventId,
    Long eventVersion,
    String taskId,
    String taskType,
    String sourceSystem,
    String status,
    String stage,
    int progress,
    String resourceRefsJson,
    String resultRefsJson,
    String traceId,
    String tenantId) {}
