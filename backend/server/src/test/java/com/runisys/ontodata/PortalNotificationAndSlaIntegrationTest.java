package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.event.TaskTerminalApplicationEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** F3a-2：SLA 标记、批量审批、审批/任务终态写入通知中心。 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalNotificationAndSlaIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private ApplicationEventPublisher applicationEventPublisher;

  @Test
  void slaOverdueBatchDecideAndNotifications() throws Exception {
    String overdue =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "approvalType": "R4_TOOL_CALL",
                          "sourceSystem": "mcp-gateway",
                          "title": "超期待审",
                          "slaDeadline": "2020-01-01T00:00:00Z"
                        }
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.slaStatus").value("OVERDUE"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String overdueCode = objectMapper.readTree(overdue).path("code").asText();

    String onTime =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "approvalType": "DATA_GRANT",
                          "sourceSystem": "data-platform",
                          "title": "未设 SLA"
                        }
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.slaStatus").value("NONE"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String onTimeCode = objectMapper.readTree(onTime).path("code").asText();

    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", overdueCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVED\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slaStatus").value("MISSED"));

    mockMvc
        .perform(
            post("/api/v1/approvals/batch-decision")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"codes\":[\""
                        + overdueCode
                        + "\",\""
                        + onTimeCode
                        + "\"],\"decision\":\"REJECTED\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.succeeded[0].code").value(onTimeCode))
        .andExpect(jsonPath("$.failed[0].code").value(overdueCode));

    mockMvc
        .perform(get("/api/v1/personal/notifications"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));

    applicationEventPublisher.publishEvent(
        new TaskTerminalApplicationEvent("exe-f3a2", "SUCCESS", "algorithm-recombine", "default"));

    String inbox =
        mockMvc
            .perform(get("/api/v1/personal/notifications"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[?(@.type=='TASK_COMPLETED')].resourceRef").value("exe-f3a2"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    JsonNode items = objectMapper.readTree(inbox).path("items");
    String notificationId = "";
    for (JsonNode item : items) {
      if ("APPROVAL_DECIDED".equals(item.path("type").asText())) {
        notificationId = item.path("id").asText();
        break;
      }
    }

    mockMvc
        .perform(post("/api/v1/personal/notifications/{id}/read", notificationId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.readAt").isNotEmpty());

    mockMvc
        .perform(get("/api/v1/personal/notifications/unread-count"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unread").value(org.hamcrest.Matchers.greaterThanOrEqualTo(0)));
  }
}
