package com.runisys.ontodata.portal.common.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.portal.common.TenantContext;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * OutboxEventService 单测：信封字段（契约 integration v1）、租户装载与主题映射。
 *
 * <p>信封结构对齐 contracts/integration/v1/event-envelope.schema.json：必含
 * eventId/eventType/schemaVersion/producer/
 * occurredAt/aggregateType/aggregateId/aggregateVersion，payload 只放必要状态变化。
 */
class OutboxEventServiceTest {

  private OutboxEventRepository outboxRepository;
  private OutboxEventService service;
  private final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeEach
  void setUp() {
    outboxRepository = mock(OutboxEventRepository.class);
    service = new OutboxEventService(outboxRepository, objectMapper);
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
    PermissionContext.clear();
  }

  @Test
  void recordBuildsContractEnvelopeAndMapsTopic() throws Exception {
    TenantContext.set("tenant-a");
    PermissionContext.set("org-1", null, null);
    Map<String, Object> payload =
        Map.of(
            "approvalCode", "apr-1a2b3c4d",
            "approvalType", "R4_TOOL_CALL",
            "sourceSystem", "mcp-gateway",
            "sourceCode", "cfm-9f8e7d6c",
            "decision", "APPROVED",
            "decidedBy", "bob",
            "decidedAt", "2026-08-17T00:00:00Z");

    service.record("portal.approval.decided", "ApprovalRequest", "apr-1a2b3c4d", "1", payload);

    ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
    verify(outboxRepository).save(captor.capture());
    OutboxEvent saved = captor.getValue();
    assertEquals("portal.approval.decided", saved.getEventType());
    assertEquals(EventTopics.PORTAL_APPROVAL_V1, saved.getTopic());
    assertEquals("apr-1a2b3c4d", saved.getAggregateId());
    assertEquals("tenant-a", saved.getTenantId());

    JsonNode envelope = objectMapper.readTree(saved.getEnvelopeJson());
    assertNotNull(envelope.path("eventId").asText());
    assertEquals("portal.approval.decided", envelope.path("eventType").asText());
    assertEquals("1.0", envelope.path("schemaVersion").asText());
    assertEquals("portal", envelope.path("producer").asText());
    assertEquals("tenant-a", envelope.path("tenantId").asText());
    assertEquals("org-1", envelope.path("organizationId").asText());
    assertEquals("ApprovalRequest", envelope.path("aggregateType").asText());
    assertEquals("apr-1a2b3c4d", envelope.path("aggregateId").asText());
    assertEquals("1", envelope.path("aggregateVersion").asText());
    assertEquals("mcp-gateway", envelope.path("payload").path("sourceSystem").asText());
    assertEquals("APPROVED", envelope.path("payload").path("decision").asText());
  }

  @Test
  void recordFallsBackToDefaultTenantOutsideRequest() throws Exception {
    service.record(
        "portal.approval.decided",
        "ApprovalRequest",
        "apr-5e6f7a8b",
        "1",
        Map.of("decision", "REJECTED"));

    ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
    verify(outboxRepository).save(captor.capture());
    JsonNode envelope = objectMapper.readTree(captor.getValue().getEnvelopeJson());
    assertEquals(TenantContext.DEFAULT_TENANT, envelope.path("tenantId").asText());
    assertEquals(EventTopics.PORTAL_APPROVAL_V1, captor.getValue().getTopic());
  }

  @Test
  void recordRejectsUnregisteredEventType() {
    assertThrows(
        IllegalArgumentException.class,
        () -> service.record("unknown.event", "X", "x-1", "1", Map.of()));
    verify(outboxRepository, org.mockito.Mockito.never()).save(any());
  }
}
