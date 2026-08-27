package com.runisys.ontodata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;

import com.runisys.ontodata.portal.common.event.PortalTopicRegistry;
import com.runisys.ontodata.sdk.events.OutboxEvent;
import com.runisys.ontodata.sdk.events.OutboxEventRepository;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * WP-07 审批决定事件端到端：POST /approvals/{code}/decision 决策落定同事务落库 portal.approval.decided Outbox
 * 事件，信封符合契约 integration v1、载荷符合 contracts 仓库 portal-approval-decided Schema； 终态重复决策 409 且不重复发事件。
 *
 * <p>测试环境显式关闭 Kafka 发布器（application-test.yml ontodata.events.kafka.enabled=false）， 只验证"事件随业务事务可靠落库"
 * 这一半；发布到总线的另一半由 common 模块 OutboxKafkaPublisherTest（mock KafkaTemplate）覆盖。
 *
 * <p>契约 Schema 从并置的 contracts 仓库读取（工作区约定各仓库同级 checkout）：
 * ../../../contracts/integration/。该路径缺失说明工作区不完整，直接失败而非跳过。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalApprovalDecidedEventTest {

  /** 契约仓库集成目录（相对 server 模块工作目录：ontodata/portal/backend/server → ontodata/contracts）。 */
  private static final File CONTRACT_INTEGRATION_DIR = new File("../../../contracts/integration");

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final JsonSchemaFactory SCHEMA_FACTORY =
      JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);

  @Autowired private MockMvc mockMvc;
  @Autowired private OutboxEventRepository outboxEventRepository;

  @Test
  void decisionRecordsContractConformantEventAndRepeatDecisionDoesNotRepublish() throws Exception {
    assertTrue(
        CONTRACT_INTEGRATION_DIR.isDirectory(),
        "契约仓库未 checkout 到预期位置：" + CONTRACT_INTEGRATION_DIR.getAbsolutePath());

    // 1. 业务软件（mcp-gateway R4 确认卡升级）创建审批单
    MvcResult created =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "approvalType": "R4_TOOL_CALL",
                          "sourceSystem": "mcp-gateway",
                          "sourceCode": "cfm-9f8e7d6c",
                          "title": "高风险工具调用审批"
                        }
                        """))
            .andExpect(status().isCreated())
            .andReturn();
    String code = MAPPER.readTree(created.getResponse().getContentAsString()).path("code").asText();
    assertTrue(code.matches("^apr-[0-9a-f]{8}$"), "审批单编码应符合 apr-* 稳定编码约定");

    // 2. 人工决策 APPROVED → 同事务落 Outbox 事件
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"decision\":\"APPROVED\",\"decisionNote\":\"同意\"}"))
        .andExpect(status().isOk());

    List<OutboxEvent> events = decidedEventsOf(code);
    assertEquals(1, events.size(), "决策落定应恰好产生一条 portal.approval.decided 事件");
    OutboxEvent event = events.get(0);
    assertEquals("portal.approval.decided", event.getEventType());
    assertEquals(PortalTopicRegistry.PORTAL_APPROVAL_V1, event.getTopic());
    assertEquals(code, event.getAggregateId());
    // 测试环境 Kafka 关闭：事件留在表内待投（EVT-01：不影响主流程，恢复后补投）
    assertNull(event.getPublishedAt());

    // 3. 信封校验（契约 integration/v1/event-envelope.schema.json）
    JsonNode envelope = MAPPER.readTree(event.getEnvelopeJson());
    assertConforms(new File(CONTRACT_INTEGRATION_DIR, "v1/event-envelope.schema.json"), envelope);
    assertEquals("portal.approval.decided", envelope.path("eventType").asText());
    assertEquals("1.0", envelope.path("schemaVersion").asText());
    assertEquals("portal", envelope.path("producer").asText());
    assertEquals("ApprovalRequest", envelope.path("aggregateType").asText());
    assertEquals(code, envelope.path("aggregateId").asText());
    assertEquals("1", envelope.path("aggregateVersion").asText());
    assertEquals("default", envelope.path("tenantId").asText());

    // 4. 载荷校验（契约 integration/event-types/portal-approval-decided.schema.json）
    JsonNode payload = envelope.path("payload");
    assertConforms(
        new File(CONTRACT_INTEGRATION_DIR, "event-types/portal-approval-decided.schema.json"),
        payload);
    assertEquals(code, payload.path("approvalCode").asText());
    assertEquals("R4_TOOL_CALL", payload.path("approvalType").asText());
    assertEquals("mcp-gateway", payload.path("sourceSystem").asText());
    assertEquals("cfm-9f8e7d6c", payload.path("sourceCode").asText());
    assertEquals("APPROVED", payload.path("decision").asText());
    assertEquals("dev-user", payload.path("decidedBy").asText());
    assertEquals("同意", payload.path("decisionNote").asText());

    // 5. 终态重复决策 409，且不重复发事件
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"REJECTED\"}"))
        .andExpect(status().isConflict());
    assertEquals(1, decidedEventsOf(code).size(), "重复决策不得重复发事件");
  }

  private List<OutboxEvent> decidedEventsOf(String approvalCode) {
    List<OutboxEvent> matched = new ArrayList<>();
    for (OutboxEvent event : outboxEventRepository.findAll()) {
      if ("portal.approval.decided".equals(event.getEventType())
          && approvalCode.equals(event.getAggregateId())) {
        matched.add(event);
      }
    }
    return matched;
  }

  /** 用契约仓库的 Schema 校验实际产生的 JSON；任何违反（含 additionalProperties）都失败。 */
  private void assertConforms(File schemaFile, JsonNode instance) throws Exception {
    assertTrue(schemaFile.isFile(), "契约 Schema 不存在：" + schemaFile.getAbsolutePath());
    JsonSchema schema = SCHEMA_FACTORY.getSchema(MAPPER.readTree(schemaFile));
    List<ValidationMessage> errors = new ArrayList<>(schema.validate(instance));
    assertTrue(errors.isEmpty(), "不符合契约 " + schemaFile.getName() + "：" + errors);
  }
}
