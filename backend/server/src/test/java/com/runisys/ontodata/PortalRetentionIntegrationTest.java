package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 数据保留端到端（M5）：retention.days=0（截点=当前时刻，所有此前创建的终态记录可清理）。
 *
 * <p>验收：状态统计各中心可清理数；dryRun 只统计不删除；真实清理删除终态记录且 非终态记录与结果引用（可追踪率 100%）不受影响。独立 H2 内存库。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = {
      "ontodata.retention.days=0",
      "spring.datasource.url=jdbc:h2:mem:portal_retention_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
    })
class PortalRetentionIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  @Test
  void cleansTerminalRecordsButNeverActiveDataOrResults() throws Exception {
    // 终态数据：任务 SUCCESS / 审批 APPROVED / 需求 COMPLETED / 反馈 HANDLED / 公告 ARCHIVED
    mockMvc
        .perform(
            put("/api/v1/tasks/task-retention")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"taskId":"task-retention","taskType":"DATA_INGEST","sourceSystem":"data-platform",
                     "status":"SUCCESS","progress":100,"resourceRefs":[],"resultRefs":[]}
                    """))
        .andExpect(status().isOk());

    String approvalJson =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"approvalType":"DATA_GRANT","sourceSystem":"data-platform",
                         "title":"保留验收审批","requester":"retention"}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String approvalCode = objectMapper.readTree(approvalJson).path("code").asText();
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", approvalCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVED\",\"decisionBy\":\"retention\"}"))
        .andExpect(status().isOk());

    String requirementJson =
        mockMvc
            .perform(
                post("/api/v1/requirements")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"requirementType":"DATA","title":"保留验收需求","requester":"retention"}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String requirementCode = objectMapper.readTree(requirementJson).path("code").asText();
    mockMvc
        .perform(post("/api/v1/requirements/{code}/analyze", requirementCode))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/assign", requirementCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assigneeSystem\":\"data-platform\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/v1/requirements/{code}/progress", requirementCode))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/complete", requirementCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"保留验收完成\"}"))
        .andExpect(status().isOk());

    String feedbackJson =
        mockMvc
            .perform(
                post("/api/v1/operations/feedbacks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"保留验收反馈\",\"content\":\"内容\"}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String feedbackCode = objectMapper.readTree(feedbackJson).path("code").asText();
    mockMvc
        .perform(
            post("/api/v1/operations/feedbacks/{code}/handle", feedbackCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"handleNote\":\"已处理\"}"))
        .andExpect(status().isOk());

    String noticeJson =
        mockMvc
            .perform(
                post("/api/v1/operations/notices")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"title":"保留验收公告","content":"内容","section":"announcement"}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String noticeCode = objectMapper.readTree(noticeJson).path("code").asText();
    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/publish", noticeCode))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/archive", noticeCode))
        .andExpect(status().isOk());

    // 非终态数据与结果引用：永不清理
    mockMvc
        .perform(
            post("/api/v1/approvals")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"approvalType":"DATA_GRANT","sourceSystem":"data-platform",
                     "title":"保留验收进行中审批","requester":"retention"}
                    """))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/retention-result")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"resultType\":\"DATASET\",\"resourceRefs\":[],\"metadata\":{}}"))
        .andExpect(status().isOk());

    // 状态统计：五类终态各 >=1
    mockMvc
        .perform(get("/api/v1/retention/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.retentionDays").value(0))
        .andExpect(jsonPath("$.tasks").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.approvals").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.requirements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.feedbacks").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
        .andExpect(jsonPath("$.notices").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    // dryRun：只统计不删除
    mockMvc
        .perform(post("/api/v1/retention/cleanup").param("dryRun", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dryRun").value(true))
        .andExpect(jsonPath("$.approvals").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    mockMvc
        .perform(get("/api/v1/approvals").param("status", "APPROVED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    // 真实清理：终态记录删除，非终态与结果引用保留
    mockMvc
        .perform(post("/api/v1/retention/cleanup").param("dryRun", "false"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.dryRun").value(false))
        .andExpect(jsonPath("$.approvals").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    mockMvc
        .perform(get("/api/v1/approvals").param("status", "APPROVED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/requirements").param("status", "COMPLETED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/tasks").param("status", "SUCCESS"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/operations/notices").param("status", "ARCHIVED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/operations/feedbacks").param("status", "HANDLED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));

    // 非终态审批与结果引用仍在
    mockMvc
        .perform(get("/api/v1/approvals").param("status", "PENDING"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    mockMvc
        .perform(get("/api/v1/results/data-platform/retention-result"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.resultId").value("retention-result"));
  }
}
