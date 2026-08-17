package com.runisys.ontodata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.taskcenter.application.ProjectionRebuildService;
import com.runisys.ontodata.portal.taskcenter.application.TaskProjectionEventHandler;
import com.runisys.ontodata.portal.taskcenter.application.TaskProjectionEventHandler.ProcessingResult;
import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalEventInboxRepository;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * 任务投影事件处理集成测试（WP-03 / EVT-01 / EVT-02）。
 *
 * <p>测试环境 {@code ontodata.events.kafka.enabled=false}（无 broker）：Kafka 监听器不装配， 直接驱动监听器核心逻辑 {@link
 * TaskProjectionEventHandler}——它与监听器走的是完全相同的 "inbox 幂等 + 乱序防护 + 投影更新"路径。broker
 * 轮询部分（ProjectionRebuildService 的 poll 循环） 依赖真实 Kafka，不在本测试覆盖。
 *
 * <p>覆盖：重复投递只处理一次；乱序（低 aggregateVersion）跳过；事件→投影映射（recombine 执行 / transform 能力准入与构建 / data
 * 资产生命周期各至少一例）；清空后重放可重建投影； 未知事件类型不影响消费。
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(
    properties =
        "spring.datasource.url=jdbc:h2:mem:portal_projection_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
class PortalTaskProjectionTest {

  @Autowired private TaskProjectionEventHandler handler;
  @Autowired private ProjectionRebuildService rebuildService;
  @Autowired private PortalTaskRepository taskRepository;
  @Autowired private PortalEventInboxRepository inboxRepository;

  /** 正常消费组（与生产监听器同一组名，验证 inbox 去重空间语义）。 */
  private static final String GROUP = "portal.task-projection";

  @BeforeEach
  void cleanProjection() {
    taskRepository.deleteAll();
    inboxRepository.deleteAll();
  }

  /** 构造统一事件信封（字段对齐 contracts/integration/v1/event-envelope.schema.json）。 */
  private String envelope(
      String eventId,
      String eventType,
      String producer,
      String tenantId,
      String aggregateId,
      String aggregateVersion,
      String correlationId,
      String payload) {
    return """
        {
          "eventId": "%s",
          "eventType": "%s",
          "schemaVersion": "1.0",
          "producer": "%s",
          "occurredAt": "2026-08-17T09:12:00Z",
          "tenantId": "%s",
          "aggregateType": "Execution",
          "aggregateId": "%s",
          "aggregateVersion": "%s",
          "traceId": "trace-evt",
          "correlationId": %s,
          "payload": %s
        }
        """
        .formatted(
            eventId,
            eventType,
            producer,
            tenantId,
            aggregateId,
            aggregateVersion,
            correlationId == null ? "null" : "\"" + correlationId + "\"",
            payload);
  }

  private PortalTask requireTask(String taskId, String tenantId) {
    return taskRepository
        .findByTaskIdAndTenantId(taskId, tenantId)
        .orElseThrow(() -> new AssertionError("投影不存在：" + taskId));
  }

  @Test
  void duplicateEventIsProcessedOnlyOnce() {
    String started =
        envelope(
            "evt-dup-1",
            "recombine.execution.started",
            "algorithm-recombine",
            "tenant-evt",
            "run-dup",
            "1",
            "task-exe-dup",
            "{\"executionId\":\"run-dup\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                + "\"startedBy\":\"alice\"}");

    assertEquals(ProcessingResult.APPLIED, handler.handle(GROUP, started));
    // 同一事件重复投递：inbox 命中，幂等跳过，不产生第二条投影
    assertEquals(ProcessingResult.DUPLICATE, handler.handle(GROUP, started));
    assertEquals(1, taskRepository.count(), "重复事件必须折叠");
    assertEquals(1, inboxRepository.count());
  }

  @Test
  void outOfOrderEventWithLowerAggregateVersionIsSkipped() {
    // 先到达高版本成功事件（Kafka 只保证分区内顺序，跨主题/重投场景可能乱序）
    String succeeded =
        envelope(
            "evt-oo-2",
            "recombine.execution.succeeded",
            "algorithm-recombine",
            "tenant-evt",
            "run-oo",
            "7",
            "task-exe-oo",
            "{\"executionId\":\"run-oo\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7}");
    assertEquals(ProcessingResult.APPLIED, handler.handle(GROUP, succeeded));

    // 后到达低版本开始事件：aggregateVersion <= 当前 event_version → 丢弃，不覆盖新状态
    String startedLate =
        envelope(
            "evt-oo-1",
            "recombine.execution.started",
            "algorithm-recombine",
            "tenant-evt",
            "run-oo",
            "3",
            "task-exe-oo",
            "{\"executionId\":\"run-oo\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                + "\"startedBy\":\"alice\"}");
    assertEquals(ProcessingResult.STALE, handler.handle(GROUP, startedLate));

    PortalTask task = requireTask("task-exe-oo", "tenant-evt");
    assertEquals("SUCCESS", task.getStatus(), "旧版本事件不得覆盖新状态");
    assertEquals(100, task.getProgress());
    assertEquals(7, task.getEventVersion());
    assertEquals("evt-oo-2", task.getLastEventId());
    // 乱序丢弃同样落 inbox：重复投递无需再次裁决
    assertEquals(ProcessingResult.DUPLICATE, handler.handle(GROUP, startedLate));
  }

  @Test
  void recombineExecutionEventsMapToExecutionProjection() {
    // started → RUNNING 投影，资源引用取 workflowCode@version（契约稳定编码）
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-map-1",
                "recombine.execution.started",
                "algorithm-recombine",
                "tenant-evt",
                "run-map",
                "1",
                "task-exe-map",
                "{\"executionId\":\"run-map\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                    + "\"startedBy\":\"alice\"}")));
    PortalTask task = requireTask("task-exe-map", "tenant-evt");
    assertEquals("RECOMBINE_EXECUTION", task.getTaskType());
    assertEquals("algorithm-recombine", task.getSourceSystem());
    assertEquals("RUNNING", task.getStatus());
    assertEquals("trace-evt", task.getTraceId());
    assertEquals(List.of("wf-1a2b3c4d@7"), jsonRefs(task.getResourceRefsJson()));

    // failed → FAILED，阶段落契约稳定错误码；进度不回退（保持只增）
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-map-2",
                "recombine.execution.failed",
                "algorithm-recombine",
                "tenant-evt",
                "run-map",
                "2",
                "task-exe-map",
                "{\"executionId\":\"run-map\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                    + "\"errorCode\":\"NODE_TIMEOUT\"}")));
    task = requireTask("task-exe-map", "tenant-evt");
    assertEquals("FAILED", task.getStatus());
    assertEquals("NODE_TIMEOUT", task.getStage());
    assertEquals(2, task.getEventVersion());

    // rerun-requested → RUNNING（重跑是明确的任务状态转换，契约注释）
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-map-3",
                "recombine.execution.rerun-requested",
                "algorithm-recombine",
                "tenant-evt",
                "run-map",
                "3",
                "task-exe-map",
                "{\"executionId\":\"run-map\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                    + "\"requestedBy\":\"bob\"}")));
    task = requireTask("task-exe-map", "tenant-evt");
    assertEquals("RUNNING", task.getStatus());
    assertEquals("RERUN_REQUESTED", task.getStage());

    // succeeded → SUCCESS 100%，结果引用只保留制品 URI（契约不变量：不放完整结果集）
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-map-4",
                "recombine.execution.succeeded",
                "algorithm-recombine",
                "tenant-evt",
                "run-map",
                "4",
                "task-exe-map",
                "{\"executionId\":\"run-map\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                    + "\"resultRefs\":[{\"name\":\"out\",\"uri\":\"s3://bucket/out.parquet\","
                    + "\"sha256\":\"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\"}]}")));
    task = requireTask("task-exe-map", "tenant-evt");
    assertEquals("SUCCESS", task.getStatus());
    assertEquals(100, task.getProgress());
    assertEquals(List.of("s3://bucket/out.parquet"), jsonRefs(task.getResultRefsJson()));
  }

  @Test
  void transformCapabilityAndBuildEventsMapToProjection() {
    // CapabilityVersionAdmitted（契约冻结的 PascalCase 类型）→ 能力准入任务投影
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-tx-1",
                "CapabilityVersionAdmitted",
                "algorithm-transform",
                "tenant-evt",
                "cap-1a2b3c4d",
                "5",
                "task-cap-1",
                "{\"capabilityCode\":\"cap-1a2b3c4d\",\"version\":\"1.0.0\",\"admittedBy\":\"carol\"}")));
    PortalTask capability = requireTask("task-cap-1", "tenant-evt");
    assertEquals("CAPABILITY_ADMISSION", capability.getTaskType());
    assertEquals("algorithm-transform", capability.getSourceSystem());
    assertEquals("SUCCESS", capability.getStatus());
    assertEquals(100, capability.getProgress());
    assertEquals(List.of("cap-1a2b3c4d@1.0.0"), jsonRefs(capability.getResourceRefsJson()));

    // transform.build.*（载荷 Schema 尚未冻结，按点分生命周期动词向前兼容投影）
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-tx-2",
                "transform.build.started",
                "algorithm-transform",
                "tenant-evt",
                "build-001",
                "1",
                null,
                "{}")));
    PortalTask build = requireTask("build-001", "tenant-evt");
    assertEquals("TRANSFORM_BUILD", build.getTaskType());
    assertEquals("RUNNING", build.getStatus());
  }

  @Test
  void dataAssetLifecycleEventsMapToProjection() {
    // data.asset.*（载荷 Schema 尚未冻结）：同一生命周期动词映射，无需新代码即可投影
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-dp-1",
                "data.asset.ingest.started",
                "data-platform",
                "tenant-evt",
                "ds-12345678",
                "1",
                null,
                "{\"assetCode\":\"ds-12345678\"}")));
    PortalTask task = requireTask("ds-12345678", "tenant-evt");
    assertEquals("DATA_ASSET", task.getTaskType());
    assertEquals("data-platform", task.getSourceSystem());
    assertEquals("RUNNING", task.getStatus());

    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-dp-2",
                "data.asset.ingest.succeeded",
                "data-platform",
                "tenant-evt",
                "ds-12345678",
                "2",
                null,
                "{\"assetCode\":\"ds-12345678\"}")));
    task = requireTask("ds-12345678", "tenant-evt");
    assertEquals("SUCCESS", task.getStatus());
    assertEquals(100, task.getProgress());
  }

  @Test
  void unknownEventTypeIsSkippedWithoutBreakingConsumption() {
    // 契约已冻结但与任务投影无关的类型：记日志跳过、不报错、不产生投影、不入 inbox
    // （不入 inbox 是为向前兼容：未来映射登记后可经投影重建重放补投）
    String unknown =
        envelope(
            "evt-unknown-1",
            "OntologyReleasePublished",
            "ontology-platform",
            "tenant-evt",
            "ont-1a2b3c4d",
            "1",
            null,
            "{}");
    assertEquals(ProcessingResult.UNKNOWN, handler.handle(GROUP, unknown));
    assertEquals(0, taskRepository.count());
    assertEquals(0, inboxRepository.count());

    // 后续正常事件不受影响，继续消费
    assertEquals(
        ProcessingResult.APPLIED,
        handler.handle(
            GROUP,
            envelope(
                "evt-unknown-2",
                "recombine.execution.started",
                "algorithm-recombine",
                "tenant-evt",
                "run-after",
                "1",
                null,
                "{\"executionId\":\"run-after\",\"workflowCode\":\"wf-1a2b3c4d\","
                    + "\"workflowVersion\":7,\"startedBy\":\"alice\"}")));
    assertEquals(1, taskRepository.count());
  }

  @Test
  void projectionCanBeRebuiltByReplayingEventStream() {
    // 正常消费积累投影（含一次乱序丢弃，验证重建路径裁决一致）
    List<String> events =
        List.of(
            envelope(
                "evt-rb-1",
                "recombine.execution.started",
                "algorithm-recombine",
                "tenant-evt",
                "run-rb",
                "1",
                "task-exe-rb",
                "{\"executionId\":\"run-rb\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                    + "\"startedBy\":\"alice\"}"),
            envelope(
                "evt-rb-2",
                "recombine.execution.succeeded",
                "algorithm-recombine",
                "tenant-evt",
                "run-rb",
                "2",
                "task-exe-rb",
                "{\"executionId\":\"run-rb\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7}"),
            envelope(
                "evt-rb-3",
                "CapabilityVersionAdmitted",
                "algorithm-transform",
                "tenant-evt",
                "cap-1a2b3c4d",
                "5",
                "task-cap-rb",
                "{\"capabilityCode\":\"cap-1a2b3c4d\",\"version\":\"1.0.0\",\"admittedBy\":\"carol\"}"));
    events.forEach(event -> handler.handle(GROUP, event));
    PortalTask before = requireTask("task-exe-rb", "tenant-evt");
    assertEquals("SUCCESS", before.getStatus());

    // 模拟 POST /api/v1/projections/rebuild 的重放路径（broker 轮询需真实 Kafka，不在此覆盖）：
    // 清空投影 → 一次性重建组从头重放同一事件流（复用 inbox 幂等路径）
    String rebuildGroup = "portal.task-projection-rebuild-test";
    taskRepository.deleteAll();
    assertEquals(0, taskRepository.count());
    events.forEach(
        event -> assertEquals(ProcessingResult.APPLIED, handler.handle(rebuildGroup, event)));

    // 重建后投影与事件流累积结果一致（权威状态在源系统，投影可由事件重建）
    PortalTask rebuilt = requireTask("task-exe-rb", "tenant-evt");
    assertEquals(before.getStatus(), rebuilt.getStatus());
    assertEquals(before.getProgress(), rebuilt.getProgress());
    assertEquals(before.getEventVersion(), rebuilt.getEventVersion());
    assertEquals(before.getLastEventId(), rebuilt.getLastEventId());
    assertEquals(before.getResourceRefsJson(), rebuilt.getResourceRefsJson());
    assertEquals("SUCCESS", requireTask("task-cap-rb", "tenant-evt").getStatus());

    // 重建组与正常组去重空间隔离：正常组再收到重复事件仍按自身 inbox 判定重复
    assertEquals(ProcessingResult.DUPLICATE, handler.handle(GROUP, events.get(0)));
  }

  @Test
  void rebuildEndpointRequiresKafkaEnabled() {
    // 测试环境显式关闭事件总线：重建端点必须明确拒绝（409），而不是静默成功
    ResourceStateConflictException conflict =
        assertThrows(ResourceStateConflictException.class, () -> rebuildService.rebuild());
    assertTrue(conflict.getMessage().contains("ontodata.events.kafka.enabled"));
  }

  @Test
  void tenantIdComesFromEnvelopeAndScopesProjection() {
    // tenantId 从信封取：不同租户的同一 taskId 各自独立投影
    handler.handle(
        GROUP,
        envelope(
            "evt-tn-1",
            "recombine.execution.started",
            "algorithm-recombine",
            "tenant-a",
            "run-tn",
            "1",
            null,
            "{\"executionId\":\"run-tn\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                + "\"startedBy\":\"alice\"}"));
    handler.handle(
        GROUP,
        envelope(
            "evt-tn-2",
            "recombine.execution.started",
            "algorithm-recombine",
            "tenant-b",
            "run-tn",
            "1",
            null,
            "{\"executionId\":\"run-tn\",\"workflowCode\":\"wf-1a2b3c4d\",\"workflowVersion\":7,"
                + "\"startedBy\":\"alice\"}"));
    assertEquals(2, taskRepository.count());
    assertEquals("tenant-a", requireTask("run-tn", "tenant-a").getTenantId());
    assertEquals("tenant-b", requireTask("run-tn", "tenant-b").getTenantId());
  }

  @Test
  void malformedEnvelopeIsRejectedForDeadLetterPath() {
    // 非 JSON / 缺契约必填字段：抛出异常交给 Spring Kafka 错误处理器（重试 5 次后 <topic>.dlq）
    assertThrows(Exception.class, () -> handler.handle(GROUP, "not-a-json"));
    assertThrows(
        Exception.class,
        () -> handler.handle(GROUP, "{\"eventType\":\"recombine.execution.started\"}"));
    assertEquals(0, taskRepository.count());
    assertNull(taskRepository.findByTaskIdAndTenantId("run-x", "tenant-evt").orElse(null));
  }

  /** 读取投影的引用 JSON（resourceRefsJson/resultRefsJson 为 JSON 数组字符串）。 */
  private List<String> jsonRefs(String json) {
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper()
          .readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
    } catch (Exception corrupted) {
      throw new AssertionError("投影引用 JSON 损坏", corrupted);
    }
  }
}
