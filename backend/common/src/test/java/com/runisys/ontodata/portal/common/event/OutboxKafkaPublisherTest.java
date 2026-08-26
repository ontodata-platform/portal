package com.runisys.ontodata.portal.common.event;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.runisys.ontodata.sdk.context.TenantProjectContext;
import com.runisys.ontodata.sdk.events.OutboxEvent;
import com.runisys.ontodata.sdk.events.OutboxEventRepository;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

/**
 * OutboxKafkaPublisher 单测（mock KafkaTemplate，不依赖真实 broker）： 发送成功回写 publishedAt（键 =
 * aggregateId）；发送失败不标记、中止本轮（留待下轮重投，不影响主流程）。
 */
class OutboxKafkaPublisherTest {

  private OutboxEventRepository outboxRepository;
  private OutboxEventService outboxEventService;
  private KafkaTemplate<String, String> kafkaTemplate;
  private OutboxKafkaPublisher publisher;

  @BeforeEach
  void setUp() {
    outboxRepository = mock(OutboxEventRepository.class);
    outboxEventService = mock(OutboxEventService.class);
    @SuppressWarnings("unchecked")
    KafkaTemplate<String, String> template = mock(KafkaTemplate.class);
    kafkaTemplate = template;
    publisher = new OutboxKafkaPublisher(outboxRepository, outboxEventService, kafkaTemplate);
    // S2 收敛：SDK OutboxEvent 构造读取 TenantProjectContext（硬边界），测试显式装载
    TenantProjectContext.populate("tenant-a", null, null,
        TenantProjectContext.Classification.INTERNAL, false);
  }

  @org.junit.jupiter.api.AfterEach
  void tearDown() {
    TenantProjectContext.clear();
  }

  private OutboxEvent pendingEvent(String eventId, String aggregateId) {
    return new OutboxEvent(
        eventId,
        "portal.approval.decided",
        PortalTopicRegistry.PORTAL_APPROVAL_V1,
        aggregateId,
        "{\"eventId\":\"" + eventId + "\"}",
        Instant.now());
  }

  private CompletableFuture<SendResult<String, String>> completedSend() {
    return CompletableFuture.completedFuture(null);
  }

  @Test
  void publishesAndMarksPublishedAt() {
    OutboxEvent event = pendingEvent("evt-1", "apr-1a2b3c4d");
    when(outboxRepository.findByPublishedAtIsNullOrderByOccurredAtAsc(any(Pageable.class)))
        .thenReturn(List.of(event));
    when(kafkaTemplate.send(
            PortalTopicRegistry.PORTAL_APPROVAL_V1, "apr-1a2b3c4d", "{\"eventId\":\"evt-1\"}"))
        .thenReturn(completedSend());

    publisher.publishPending();

    // 键 = aggregateId（同聚合同分区保序），值为信封原文
    verify(kafkaTemplate)
        .send(PortalTopicRegistry.PORTAL_APPROVAL_V1, "apr-1a2b3c4d", "{\"eventId\":\"evt-1\"}");
    verify(outboxEventService).markPublished("evt-1");
  }

  @Test
  void failedSendIsNotMarkedAndStopsBatch() {
    OutboxEvent first = pendingEvent("evt-1", "apr-1a2b3c4d");
    OutboxEvent second = pendingEvent("evt-2", "apr-1a2b3c4d");
    when(outboxRepository.findByPublishedAtIsNullOrderByOccurredAtAsc(any(Pageable.class)))
        .thenReturn(List.of(first, second));
    when(kafkaTemplate.send(anyString(), anyString(), anyString()))
        .thenReturn(CompletableFuture.failedFuture(new RuntimeException("broker 不可达")));

    // 不抛出：发送失败仅记警告，事件留表待下轮重投
    assertDoesNotThrow(() -> publisher.publishPending());

    // 第一条失败后即中止本轮：第二条同聚合事件不得抢跑上总线
    verify(kafkaTemplate, times(1)).send(anyString(), anyString(), anyString());
    verify(outboxEventService, never()).markPublished(anyString());
    assertNull(first.getPublishedAt());
  }

  @Test
  void acknowledgeIsIdempotent() {
    OutboxEvent event = pendingEvent("evt-1", "apr-1a2b3c4d");
    assertNull(event.getPublishedAt());
    event.acknowledge(Instant.now());
    assertNotNull(event.getPublishedAt());
    // 重复 ack 无副作用（不改变首次时间）
    var firstAck = event.getPublishedAt();
    event.acknowledge(Instant.now().plusSeconds(60));
    assertEquals(firstAck, event.getPublishedAt());
  }
}
