package com.runisys.ontodata.portal.common.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.sdk.events.OutboxEvent;
import com.runisys.ontodata.sdk.events.OutboxEventRepository;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.RequestTraceFilter;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Outbox 事件服务：事件与业务变更同事务落库（由调用方在业务事务内调用 record）， 按契约 integration v1 事件信封生成完整 JSON；发布由 {@link
 * OutboxKafkaPublisher} 异步轮询完成。
 *
 * <p>不变量（契约 integration/README）：载荷只放必要状态变化与资源引用（稳定编码、版本），不放完整业务对象与敏感数据； 消费者按 eventId 去重，以
 * aggregateVersion 防旧事件覆盖；生产 Outbox、消费 Inbox。
 */
@Service("portalOutboxEventService")
public class OutboxEventService {

  /** 信封 producer 枚举值（契约 integration/v1/event-envelope.schema.json）。 */
  public static final String PRODUCER = "portal";

  /** 信封版本：与主题主版本（v1）对齐，破坏性载荷变更需同步升主题主版本。 */
  public static final String SCHEMA_VERSION = "1.0";

  private final OutboxEventRepository outboxRepository;
  private final ObjectMapper objectMapper;
  private final com.runisys.ontodata.sdk.events.TopicRegistry topicRegistry;

  public OutboxEventService(
      OutboxEventRepository outboxRepository,
      ObjectMapper objectMapper,
      com.runisys.ontodata.sdk.events.TopicRegistry topicRegistry) {
    this.outboxRepository = outboxRepository;
    this.objectMapper = objectMapper;
    this.topicRegistry = topicRegistry;
  }

  /**
   * 记录事件（必须在业务事务内调用，与业务变更同提交同回滚）。
   *
   * @param eventType 事件类型（点分小写，如 portal.approval.decided；契约 integration/event-types 登记）
   * @param aggregateType 聚合类型（如 ApprovalRequest）
   * @param aggregateId 聚合标识（稳定编码 apr- 前缀，不引用数据库主键）
   * @param aggregateVersion 聚合版本（消费者防旧事件覆盖）
   * @param payload 载荷：仅必要状态变化与资源引用
   */
  public void record(
      String eventType,
      String aggregateType,
      String aggregateId,
      String aggregateVersion,
      Map<String, Object> payload) {
    String topic = topicRegistry.forEventType(eventType);
    Instant now = Instant.now();
    Map<String, Object> envelope = new LinkedHashMap<>();
    String eventId = UUID.randomUUID().toString();
    envelope.put("eventId", eventId);
    envelope.put("eventType", eventType);
    envelope.put("schemaVersion", SCHEMA_VERSION);
    envelope.put("producer", PRODUCER);
    envelope.put("occurredAt", DateTimeFormatter.ISO_INSTANT.format(now));
    // 信封租户从请求级上下文取（安全模式来自 JWT claim，开发模式来自 X-Tenant-Id 头）；
    // 组织标识为可选信封字段，仅在请求携带时写入。
    envelope.put("tenantId", TenantContext.current());
    if (PermissionContext.org() != null) {
      envelope.put("organizationId", PermissionContext.org());
    }
    envelope.put("aggregateType", aggregateType);
    envelope.put("aggregateId", aggregateId);
    envelope.put("aggregateVersion", aggregateVersion);
    // 追踪标识来自 RequestTraceFilter 写入的 MDC；非请求线程（定时任务等）无 MDC 时缺省。
    String traceId = MDC.get(RequestTraceFilter.MDC_KEY);
    if (traceId != null) {
      envelope.put("traceId", traceId);
    }
    if (payload != null && !payload.isEmpty()) {
      envelope.put("payload", payload);
    }
    outboxRepository.save(
        new OutboxEvent(eventId, eventType, topic, aggregateId, toJson(envelope), now));
  }

  /** 回写 publishedAt（ack 幂等：并发/重复 ack 不改变首次时间）。独立事务方法， 供发布器在发送成功后逐条调用——单条失败不回滚已成功的 ack。 */
  @Transactional
  public void markPublished(String eventId) {
    OutboxEvent event =
        outboxRepository
            .findByEventId(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Outbox 事件不存在：" + eventId));
    event.acknowledge(Instant.now());
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("事件信封序列化失败", impossible);
    }
  }
}
