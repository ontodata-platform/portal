package com.runisys.ontodata.portal.taskcenter.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 事件信封 → 任务投影更新 的映射器（WP-03）。
 *
 * <p>映射依据 {@code contracts/integration/v1/event-envelope.schema.json} 与 {@code
 * contracts/integration/event-types/} 的冻结字段：
 *
 * <ul>
 *   <li>taskId：优先取信封 {@code correlationId}（契约注明为 operationId/taskId 关联），缺省回退 {@code aggregateId}；
 *   <li>tenantId / traceId / sourceSystem：分别取信封 {@code tenantId}（缺省 default）/ {@code traceId} /
 *       {@code producer}；
 *   <li>eventVersion：信封 {@code aggregateVersion}（契约为字符串形式的对象版本）解析为 long； 缺失或不可解析时为
 *       null——仍可投影，但不参与乱序防护；
 *   <li>资源/结果引用只放稳定编码与制品 URI（契约不变量：不放完整业务对象）。
 * </ul>
 *
 * <p>事件类型覆盖（映射表详见仓库 WP-03 交付说明）：
 *
 * <ol>
 *   <li>PascalCase 冻结类型：{@code CapabilityVersionAdmitted}（transform 能力准入）、 {@code
 *       WorkflowPublished}（recombine 工作流发布）——按逐类型载荷 Schema 精确映射；
 *   <li>点分生命周期类型（{@code <域>.<聚合>.<动词>}）：{@code recombine.execution.started/succeeded/
 *       failed/rerun-requested} 为契约已冻结类型；同一映射规则同样覆盖尚未冻结的 {@code transform.build.*} 与 {@code
 *       data.service.* / data.asset.*} 事件——这些类型在 {@code contracts/integration/event-types/} 尚无载荷
 *       Schema（P3-2/P3-4 补齐中），门户按生命周期 动词做向前兼容投影，契约冻结后无需改代码即可生效；
 *   <li>其余类型（无法识别的动词或命名）：记日志跳过、不报错、不入 inbox——契约冻结后可经 投影重建重放补投（向前兼容）。
 * </ol>
 */
@Component
public class TaskProjectionEventMapper {

  private static final Logger log = LoggerFactory.getLogger(TaskProjectionEventMapper.class);

  /** 生命周期动词 → [任务状态, 阶段, 进度]（进度语义同 portal_task：只增不回退，由应用层取 max）。 */
  private static final Map<String, String[]> LIFECYCLE_VERBS =
      Map.of(
          "started", new String[] {"RUNNING", "STARTED", "0"},
          "succeeded", new String[] {"SUCCESS", "SUCCEEDED", "100"},
          "completed", new String[] {"SUCCESS", "SUCCEEDED", "100"},
          "failed", new String[] {"FAILED", "FAILED", "0"},
          "canceled", new String[] {"CANCELED", "CANCELED", "0"},
          "cancelled", new String[] {"CANCELED", "CANCELED", "0"},
          "rerun-requested", new String[] {"RUNNING", "RERUN_REQUESTED", "0"},
          "published", new String[] {"SUCCESS", "PUBLISHED", "100"});

  private final ObjectMapper objectMapper;

  public TaskProjectionEventMapper(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  /**
   * 把事件信封映射为投影更新；返回空表示"已知的非任务事件或未知类型"（调用方记日志跳过）。
   *
   * @throws InvalidPortalEventException 信封缺契约必填字段（eventId/eventType/producer/aggregateId）
   */
  public Optional<TaskProjectionUpdate> map(JsonNode envelope) {
    String eventId = requiredText(envelope, "eventId");
    String eventType = requiredText(envelope, "eventType");
    String producer = requiredText(envelope, "producer");
    // tenantId 从信封取（WP-03 要求）；缺省按 default 租户投影
    String tenantId = orDefault(text(envelope, "tenantId"), PortalTask.DEFAULT_TENANT);
    String traceId = text(envelope, "traceId");
    String taskId =
        orDefault(text(envelope, "correlationId"), requiredText(envelope, "aggregateId"));
    Long eventVersion = parseVersion(text(envelope, "aggregateVersion"), eventId);
    JsonNode payload = envelope.path("payload");

    return switch (eventType) {
      // —— 契约已冻结的 PascalCase 类型（contracts/integration/event-types/） ——
      case "CapabilityVersionAdmitted" ->
          Optional.of(
              new TaskProjectionUpdate(
                  eventId,
                  eventVersion,
                  taskId,
                  "CAPABILITY_ADMISSION",
                  producer,
                  "SUCCESS",
                  "ADMITTED",
                  100,
                  toJson(refs(payload, "capabilityCode", "version")),
                  null,
                  traceId,
                  tenantId));
      case "WorkflowPublished" ->
          Optional.of(
              new TaskProjectionUpdate(
                  eventId,
                  eventVersion,
                  taskId,
                  "WORKFLOW_PUBLISH",
                  producer,
                  "SUCCESS",
                  "PUBLISHED",
                  100,
                  toJson(refs(payload, "workflowCode", "versionNumber")),
                  null,
                  traceId,
                  tenantId));
      default ->
          mapLifecycleEvent(
              envelope,
              eventId,
              eventType,
              producer,
              tenantId,
              traceId,
              taskId,
              eventVersion,
              payload);
    };
  }

  /**
   * 点分生命周期事件：{@code recombine.execution.*}（契约已冻结）与 {@code transform.build.*}、 {@code
   * data.service.*}、{@code data.asset.*}（契约补齐中，按同一生命周期动词向前兼容）。
   */
  private Optional<TaskProjectionUpdate> mapLifecycleEvent(
      JsonNode envelope,
      String eventId,
      String eventType,
      String producer,
      String tenantId,
      String traceId,
      String taskId,
      Long eventVersion,
      JsonNode payload) {
    // transform.capability-version.* 是目录/缓存刷新类事件（契约描述：订阅方按已发布版本刷新
    // 可读目录），不是任务生命周期事件。若按生命周期动词投影，会与同一能力 code 的准入事件
    // （CapabilityVersionAdmitted → CAPABILITY_ADMISSION 任务）撞同一 taskId（幂等键），把
    // 任务类型钉成 TRANSFORM_CAPABILITY_VERSION——显式跳过（不入 inbox，契约如需任务投影
    // 可经重放补投）。
    if (eventType.startsWith("transform.capability-version.")) {
      log.info("目录刷新类事件，不投影任务，跳过：eventType={}, eventId={}", eventType, eventId);
      return Optional.empty();
    }
    String[] segments = eventType.split("\\.");
    if (segments.length < 3) {
      log.info("未知事件类型，跳过（向前兼容，不入 inbox 以便契约冻结后重放补投）：eventType={}, eventId={}", eventType, eventId);
      return Optional.empty();
    }
    String[] mapping = LIFECYCLE_VERBS.get(segments[segments.length - 1]);
    if (mapping == null) {
      log.info("未知事件类型（动词未登记），跳过：eventType={}, eventId={}", eventType, eventId);
      return Optional.empty();
    }
    // 任务类型取前两段（域.聚合）大写：recombine.execution → RECOMBINE_EXECUTION、
    // transform.build → TRANSFORM_BUILD、data.service → DATA_SERVICE、data.asset → DATA_ASSET
    String taskType =
        (segments[0] + "_" + segments[1]).toUpperCase(java.util.Locale.ROOT).replace('-', '_');
    // 失败事件：阶段落稳定错误码（契约 failed 载荷的 errorCode 为 [A-Z0-9_] 稳定编码）
    String stage = mapping[1];
    if ("FAILED".equals(mapping[0]) && payload.hasNonNull("errorCode")) {
      stage = payload.path("errorCode").asText();
    }
    return Optional.of(
        new TaskProjectionUpdate(
            eventId,
            eventVersion,
            taskId,
            taskType,
            producer,
            mapping[0],
            stage,
            Integer.parseInt(mapping[2]),
            toJson(resourceRefs(payload)),
            toJson(resultRefs(payload)),
            traceId,
            tenantId));
  }

  /** 资源引用：执行/工作流类事件取 workflowCode@version；能力类事件取 capabilityCode@version。 */
  private List<String> resourceRefs(JsonNode payload) {
    List<String> refs = new ArrayList<>();
    appendRef(refs, payload, "workflowCode", "workflowVersion");
    appendRef(refs, payload, "capabilityCode", "version");
    return refs.isEmpty() ? null : refs;
  }

  /** 结果引用：成功事件载荷 resultRefs 为 {name, uri, sha256} 制品引用，投影只保留 URI。 */
  private List<String> resultRefs(JsonNode payload) {
    JsonNode refs = payload.path("resultRefs");
    if (!refs.isArray() || refs.isEmpty()) {
      return null;
    }
    List<String> uris = new ArrayList<>();
    for (JsonNode ref : refs) {
      if (ref.hasNonNull("uri")) {
        uris.add(ref.path("uri").asText());
      }
    }
    return uris.isEmpty() ? null : uris;
  }

  /** PascalCase 冻结类型的引用：code@version（versionNumber 为整型，统一 toString）。 */
  private List<String> refs(JsonNode payload, String codeField, String versionField) {
    List<String> refs = new ArrayList<>();
    appendRef(refs, payload, codeField, versionField);
    return refs.isEmpty() ? null : refs;
  }

  private void appendRef(
      List<String> refs, JsonNode payload, String codeField, String versionField) {
    if (payload.hasNonNull(codeField)) {
      String code = payload.path(codeField).asText();
      refs.add(
          payload.hasNonNull(versionField)
              ? code + "@" + payload.path(versionField).asText()
              : code);
    }
  }

  /** aggregateVersion 契约为字符串（对象版本）；不可解析时返回 null 并记日志（不参与乱序防护）。 */
  private Long parseVersion(String aggregateVersion, String eventId) {
    if (aggregateVersion == null) {
      return null;
    }
    try {
      return Long.parseLong(aggregateVersion.trim());
    } catch (NumberFormatException notNumeric) {
      log.warn(
          "事件 aggregateVersion 不可解析为数值，按无版本事件处理：eventId={}, aggregateVersion={}",
          eventId,
          aggregateVersion);
      return null;
    }
  }

  private String requiredText(JsonNode envelope, String field) {
    String value = text(envelope, field);
    if (value == null) {
      throw new InvalidPortalEventException("事件信封缺少契约必填字段：" + field);
    }
    return value;
  }

  private String text(JsonNode envelope, String field) {
    JsonNode node = envelope.get(field);
    if (node == null || !node.isTextual() || node.asText().isBlank()) {
      return null;
    }
    return node.asText().trim();
  }

  private String orDefault(String value, String fallback) {
    return value == null ? fallback : value;
  }

  private String toJson(List<String> refs) {
    if (refs == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(refs);
    } catch (com.fasterxml.jackson.core.JsonProcessingException impossible) {
      throw new IllegalStateException("投影引用序列化失败", impossible);
    }
  }
}
