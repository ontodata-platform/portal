package com.runisys.ontodata.portal.common.event;

import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Outbox → Kafka 发布器：轮询未发布事件（published_at IS NULL，按 occurred_at 升序）， 逐条写入目标主题（键 =
 * aggregateId，同聚合事件落同分区保序），成功后回写 publishedAt。
 *
 * <p>EVT-01 语义说明：Outbox 只保证事件"可靠到达总线"（at-least-once）——发布成功才回写 publishedAt，失败留待下一轮重试，
 * 因此同一事件可能重复投递，消费位点（offset）与去重（按 eventId）一律归消费者负责，生产侧不感知订阅进度。
 *
 * <p>降级语义：开关 {@code ontodata.events.kafka.enabled=false} 或 Kafka 不可达都不影响主流程—— 前者整个 Bean
 * 不装配，后者本轮发送失败仅记警告、事件留在表内等待恢复后补投。
 */
@Component
@ConditionalOnProperty(
    prefix = "ontodata.events.kafka",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true)
public class OutboxKafkaPublisher {

  private static final Logger log = LoggerFactory.getLogger(OutboxKafkaPublisher.class);

  /** 单轮最大投递条数：积压时多轮消化，避免长事务与单次轮询过大。 */
  private static final int BATCH_SIZE = 100;

  /** 单条发送等待上限：配合生产者 max.block.ms/delivery.timeout.ms 配置，保证 Kafka 不可达时快速失败转入下轮。 */
  private static final long SEND_TIMEOUT_SECONDS = 10;

  private final OutboxEventRepository outboxRepository;
  private final OutboxEventService outboxEventService;
  private final KafkaTemplate<String, String> kafkaTemplate;

  public OutboxKafkaPublisher(
      OutboxEventRepository outboxRepository,
      OutboxEventService outboxEventService,
      KafkaTemplate<String, String> kafkaTemplate) {
    this.outboxRepository = outboxRepository;
    this.outboxEventService = outboxEventService;
    this.kafkaTemplate = kafkaTemplate;
  }

  /**
   * 轮询投递一轮。每条经 {@link OutboxEventService#markPublished} 独立小事务回写 publishedAt： 单条失败不阻塞后续轮次，也不回滚已成功的
   * ack。
   *
   * <p>发送失败（Kafka 不可达/超时）只记警告并中止本轮——事件保持未发布，下一轮自动重投，主流程（业务写入）从不依赖本方法结果。
   */
  @Scheduled(
      fixedDelayString = "${ontodata.events.outbox.poll-interval-ms:5000}",
      initialDelayString = "${ontodata.events.outbox.initial-delay-ms:10000}")
  public void publishPending() {
    for (OutboxEvent event :
        outboxRepository.findByPublishedAtIsNullOrderByOccurredAtAsc(
            PageRequest.of(0, BATCH_SIZE))) {
      try {
        // 键 = aggregateId：同一聚合的事件哈希到同一分区，消费者按分区有序消费。
        kafkaTemplate
            .send(event.getTopic(), event.getAggregateId(), event.getEnvelopeJson())
            .get(SEND_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      } catch (Exception sendFailure) {
        // InterruptedException 也落入此处：不重置中断标记是有意为之——调度线程由 Spring 管理，
        // 本轮中止后线程回归池，下一轮由调度器重新触发。
        log.warn(
            "Outbox 事件投递失败（留待下轮重投）：eventId={} topic={} 原因={}",
            event.getEventId(),
            event.getTopic(),
            sendFailure.getMessage());
        return;
      }
      outboxEventService.markPublished(event.getEventId());
    }
  }
}
