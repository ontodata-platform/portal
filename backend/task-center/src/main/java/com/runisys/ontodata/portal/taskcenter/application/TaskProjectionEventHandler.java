package com.runisys.ontodata.portal.taskcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.event.TaskTerminalApplicationEvent;
import com.runisys.ontodata.portal.taskcenter.domain.PortalEventInbox;
import com.runisys.ontodata.portal.taskcenter.domain.PortalEventInboxId;
import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalEventInboxRepository;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 任务投影事件处理器（WP-03 / EVT-01）：Kafka 监听器与投影重建共用的核心逻辑， 抽成独立服务以便脱离 broker 直接单测。
 *
 * <p><b>单事务处理（Inbox 幂等）：</b>每条事件在一个事务内"插 inbox + 更新投影"——
 *
 * <ol>
 *   <li>重复事件：(consumer_id, event_id) 命中 inbox 主键 → 直接跳过（幂等）；并发下同组同事件的 第二次插入触发主键冲突回滚，由 Spring Kafka
 *       重试再次消费后按命中跳过；
 *   <li>乱序事件：信封 aggregateVersion（解析为 eventVersion）&lt;= 投影当前 event_version →
 *       丢弃（策略：旧版本事件不覆盖新状态，信封契约"消费者用其防止旧事件覆盖新状态"）； 丢弃同样落 inbox——这是已完成的裁决，重复投递无需再次评估；
 *   <li>未知类型：记日志跳过、不报错、<b>不入 inbox</b>——契约冻结后可经投影重建重放补投 （向前兼容）。
 * </ol>
 *
 * <p>解析失败或信封缺契约必填字段抛 {@link InvalidPortalEventException}：投递侧不可恢复， 由 Spring Kafka 错误处理器按 ADR-006
 * 重试（指数退避，上限 5 次）后投递 {@code <topic>.dlq} 死信。
 */
@Service
public class TaskProjectionEventHandler {

  private static final Logger log = LoggerFactory.getLogger(TaskProjectionEventHandler.class);

  /** 单条事件的处理结果（供日志、重建统计与测试断言）。 */
  public enum ProcessingResult {
    /** 已应用到投影。 */
    APPLIED,
    /** 重复事件（inbox 命中），幂等跳过。 */
    DUPLICATE,
    /** 乱序事件（aggregateVersion <= 当前 event_version），丢弃。 */
    STALE,
    /** 未知事件类型，跳过（向前兼容）。 */
    UNKNOWN
  }

  private static final Set<String> TERMINAL_STATUSES = Set.of("SUCCESS", "FAILED", "CANCELED");

  private final PortalTaskRepository taskRepository;
  private final PortalEventInboxRepository inboxRepository;
  private final TaskProjectionEventMapper mapper;
  private final ObjectMapper objectMapper;
  private final ApplicationEventPublisher applicationEventPublisher;

  public TaskProjectionEventHandler(
      PortalTaskRepository taskRepository,
      PortalEventInboxRepository inboxRepository,
      TaskProjectionEventMapper mapper,
      ObjectMapper objectMapper,
      ApplicationEventPublisher applicationEventPublisher) {
    this.taskRepository = taskRepository;
    this.inboxRepository = inboxRepository;
    this.mapper = mapper;
    this.objectMapper = objectMapper;
    this.applicationEventPublisher = applicationEventPublisher;
  }

  /**
   * 处理一条事件信封 JSON。
   *
   * @param consumerId 消费组标识（ADR-006：消费组名即独立位点，inbox 去重空间按组隔离）
   * @param envelopeJson 统一事件信封（contracts/integration/v1/event-envelope.schema.json）
   */
  @Transactional
  public ProcessingResult handle(String consumerId, String envelopeJson) {
    JsonNode envelope = parse(envelopeJson);
    String eventId = envelope.path("eventId").asText("").trim();
    if (eventId.isEmpty()) {
      throw new InvalidPortalEventException("事件信封缺少契约必填字段：eventId");
    }

    // 1) Inbox 幂等：同一消费组内同一事件只处理一次
    PortalEventInboxId inboxId = new PortalEventInboxId(consumerId, eventId);
    if (inboxRepository.existsById(inboxId)) {
      log.debug("重复事件，inbox 命中跳过：consumerId={}, eventId={}", consumerId, eventId);
      return ProcessingResult.DUPLICATE;
    }

    // 2) 事件 → 投影映射；未知类型记日志跳过（不入 inbox，契约冻结后可重放补投）
    Optional<TaskProjectionUpdate> mapped = mapper.map(envelope);
    if (mapped.isEmpty()) {
      return ProcessingResult.UNKNOWN;
    }
    TaskProjectionUpdate update = mapped.get();

    // 3) 乱序防护：旧版本事件不覆盖新状态（event_version 为投影的已应用版本高水位）
    Instant now = Instant.now();
    PortalTask existing =
        taskRepository.findByTaskIdAndTenantId(update.taskId(), update.tenantId()).orElse(null);
    if (existing != null
        && update.eventVersion() != null
        && update.eventVersion() <= existing.getEventVersion()) {
      log.info(
          "乱序事件丢弃：eventId={}, aggregateVersion={} <= 当前 eventVersion={}（taskId={}）",
          eventId,
          update.eventVersion(),
          existing.getEventVersion(),
          update.taskId());
      inboxRepository.save(new PortalEventInbox(consumerId, eventId, now));
      return ProcessingResult.STALE;
    }

    // 4) 应用投影 + 落 inbox（同事务提交）
    apply(existing, update, now);
    inboxRepository.save(new PortalEventInbox(consumerId, eventId, now));
    if (TERMINAL_STATUSES.contains(update.status())) {
      applicationEventPublisher.publishEvent(
          new TaskTerminalApplicationEvent(
              update.taskId(), update.status(), update.sourceSystem(), update.tenantId()));
    }
    return ProcessingResult.APPLIED;
  }

  private void apply(PortalTask existing, TaskProjectionUpdate update, Instant now) {
    if (existing == null) {
      PortalTask created =
          new PortalTask(
              update.taskId(),
              update.taskType(),
              update.sourceSystem(),
              null,
              update.status(),
              update.stage(),
              update.progress(),
              update.resourceRefsJson(),
              update.resultRefsJson(),
              update.traceId(),
              update.tenantId(),
              now);
      created.applyEvent(
          update.status(),
          update.stage(),
          update.progress(),
          update.resourceRefsJson(),
          update.resultRefsJson(),
          update.traceId(),
          update.eventVersion(),
          update.eventId(),
          now);
      taskRepository.saveAndFlush(created);
      return;
    }
    existing.applyEvent(
        update.status(),
        update.stage(),
        update.progress(),
        update.resourceRefsJson(),
        update.resultRefsJson(),
        update.traceId(),
        update.eventVersion(),
        update.eventId(),
        now);
  }

  private JsonNode parse(String envelopeJson) {
    try {
      JsonNode envelope = objectMapper.readTree(envelopeJson);
      if (envelope == null || !envelope.isObject()) {
        throw new InvalidPortalEventException("事件信封不是合法 JSON 对象");
      }
      return envelope;
    } catch (JsonProcessingException malformed) {
      throw new InvalidPortalEventException("事件信封不是合法 JSON", malformed);
    }
  }
}
