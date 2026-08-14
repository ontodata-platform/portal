package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.approvalcenter.infrastructure.ApprovalRequestRepository;
import com.runisys.ontodata.portal.resultcenter.infrastructure.PortalResultRepository;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 门户端到端（M4 Task 1 验收）：
 *
 * <ol>
 *   <li>任务聚合副本幂等 upsert（重复事件不产生脏数据、进度只增），按状态/来源过滤；
 *   <li>审批单 PENDING→APPROVED/REJECTED，终态重复审批 409；
 *   <li>结果登记与查询，缺来源信息拒绝登记（路径强约束）。
 * </ol>
 *
 * <p>独立 H2 内存库；三个中心同库联测，验证 server 装配与 Flyway 迁移一致。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private PortalTaskRepository taskRepository;
  @Autowired private ApprovalRequestRepository approvalRepository;
  @Autowired private PortalResultRepository resultRepository;

  private String taskJson(
      String taskId, String status, int progress, String ownerSystem, String stage) {
    return """
        {
          "taskId": "%s",
          "taskType": "DATA_INGEST",
          "ownerSystem": "%s",
          "status": "%s",
          "stage": "%s",
          "progress": %d,
          "resourceRefs": ["ds-12345678"],
          "resultRefs": [],
          "traceId": "trace-1"
        }
        """
        .formatted(taskId, ownerSystem, status, stage, progress);
  }

  @Test
  void taskCenterIdempotentUpsertAndFilter() throws Exception {
    // 首次上报：创建聚合副本
    mockMvc
        .perform(
            put("/api/v1/tasks/task-100")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskJson("task-100", "RUNNING", 10, "data-platform", "EXTRACT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.taskId").value("task-100"))
        .andExpect(jsonPath("$.progress").value(10));

    // 重复事件：进度只增、不产生第二条记录
    mockMvc
        .perform(
            put("/api/v1/tasks/task-100")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskJson("task-100", "RUNNING", 30, "data-platform", "LOAD")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.progress").value(30))
        .andExpect(jsonPath("$.stage").value("LOAD"));
    Assertions.assertEquals(1, taskRepository.count(), "同一 taskId 幂等折叠");

    // 进度回退事件：保持只增
    mockMvc
        .perform(
            put("/api/v1/tasks/task-100")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskJson("task-100", "SUCCESS", 20, "data-platform", "DONE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("SUCCESS"))
        .andExpect(jsonPath("$.progress").value(30));

    // 第二个任务（另一来源软件）
    mockMvc
        .perform(
            put("/api/v1/tasks/exe-200")
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskJson("exe-200", "RUNNING", 50, "recombine", "NODE-2")))
        .andExpect(status().isOk());

    // 按来源过滤（domain 映射 ownerSystem，来源软件名是小写）
    mockMvc
        .perform(get("/api/v1/tasks").param("domain", "recombine"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].taskId").value("exe-200"));

    // 按任务类型过滤（type 映射 taskType，大写编码）
    mockMvc
        .perform(get("/api/v1/tasks").param("type", "DATA_INGEST"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(2));

    // 按状态过滤
    mockMvc
        .perform(get("/api/v1/tasks").param("status", "RUNNING"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].taskId").value("exe-200"));

    // 详情
    mockMvc
        .perform(get("/api/v1/tasks/task-100"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.resourceRefs[0]").value("ds-12345678"));

    // 不存在
    mockMvc.perform(get("/api/v1/tasks/missing-1")).andExpect(status().isNotFound());
  }

  @Test
  void approvalCenterTerminalStateProtection() throws Exception {
    String approvalJson =
        """
        {
          "approvalType": "R4_TOOL_CALL",
          "sourceSystem": "mcp-gateway",
          "sourceCode": "cfm-12345678",
          "title": "发布本体版本 r1 需要审批",
          "detail": {"tool": "ontology.publish_release", "riskLevel": "R4"},
          "requester": "alice"
        }
        """;

    String created =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(approvalJson))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.startsWith("apr-")))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();
    Assertions.assertEquals(1, approvalRepository.count());

    // 审批通过
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"decision\":\"APPROVED\",\"decisionBy\":\"bob\",\"decisionNote\":\"同意\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"))
        .andExpect(jsonPath("$.decisionBy").value("bob"));

    // 终态防重：重复审批 409
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"REJECTED\",\"decisionBy\":\"bob\"}"))
        .andExpect(status().isConflict());

    // 第二张审批单走拒绝分支
    String second =
        mockMvc
            .perform(
                post("/api/v1/approvals")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "approvalType": "DATA_GRANT",
                          "sourceSystem": "data-platform",
                          "sourceCode": "ds-12345678",
                          "title": "数据订阅授权",
                          "requester": "alice"
                        }
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String secondCode = objectMapper.readTree(second).path("code").asText();
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", secondCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"REJECTED\",\"decisionBy\":\"bob\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("REJECTED"));

    // 按状态过滤 PENDING 为空（两张都终态了）
    mockMvc
        .perform(get("/api/v1/approvals").param("status", "PENDING"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));

    // 详情与不存在
    mockMvc
        .perform(get("/api/v1/approvals/{code}", code))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"));
    mockMvc.perform(get("/api/v1/approvals/apr-deadbeef")).andExpect(status().isNotFound());
  }

  @Test
  void resultCenterRegisterFindAndTraceability() throws Exception {
    String registerJson =
        """
        {
          "resultType": "DATASET",
          "resourceRefs": ["ds-12345678"],
          "metadata": {"name": "客户主数据", "rows": 100},
          "sourceTaskId": "task-100",
          "traceId": "trace-1"
        }
        """;

    // 登记：来源系统与结果标识在路径上（可追踪率 100%）
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/ds-12345678")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sourceSystem").value("data-platform"))
        .andExpect(jsonPath("$.resultId").value("ds-12345678"))
        .andExpect(jsonPath("$.sourceTaskId").value("task-100"));

    // 重复登记：幂等折叠，元数据以最新为准
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/ds-12345678")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "resultType": "DATASET",
                      "resourceRefs": ["ds-12345678"],
                      "metadata": {"name": "客户主数据 v2", "rows": 120},
                      "sourceTaskId": "task-100"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.metadata.rows").value(120));
    Assertions.assertEquals(1, resultRepository.count(), "同一结果幂等折叠");

    // 详情
    mockMvc
        .perform(get("/api/v1/results/data-platform/ds-12345678"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.metadata.name").value("客户主数据 v2"));

    // 第二个结果（重组平台执行产物）
    mockMvc
        .perform(
            put("/api/v1/results/recombine/exe-200")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "resultType": "EXECUTION_OUTPUT",
                      "resourceRefs": [],
                      "metadata": {"nodes": 3},
                      "sourceTaskId": "exe-200"
                    }
                    """))
        .andExpect(status().isOk());

    // 按类型过滤
    mockMvc
        .perform(get("/api/v1/results").param("type", "EXECUTION_OUTPUT"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].resultId").value("exe-200"));

    // 缺来源信息：非法来源系统格式拒绝
    mockMvc
        .perform(
            put("/api/v1/results/BAD_SYSTEM/x-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
        .andExpect(status().isBadRequest());

    // 不存在的结果
    mockMvc.perform(get("/api/v1/results/data-platform/nope-1")).andExpect(status().isNotFound());
  }
}
