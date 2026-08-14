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
 * 门户端到端（M4 Task 1 + Task 2 验收）：
 *
 * <ol>
 *   <li>任务聚合副本幂等 upsert（重复事件不产生脏数据、进度只增），按状态/来源过滤；
 *   <li>审批单 PENDING→APPROVED/REJECTED，终态重复审批 409；
 *   <li>结果登记与查询，缺来源信息拒绝登记（路径强约束）；
 *   <li>需求单全生命周期（登记/去重/计划/分派/完成/取消），终态防重 409，按类型/状态过滤；
 *   <li>公告草稿→发布→归档单向流转、草稿不公开；反馈处理说明必填、重复处理 409；运营统计一致。
 * </ol>
 *
 * <p>独立 H2 内存库；各中心同库联测，验证 server 装配与 Flyway 迁移一致。
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
    // 基线（跨测试共享内存库：个人中心测试也产生审批单，计数必须相对断言）
    long approvalBaseline = approvalRepository.count();
    String pendingBaselineJson =
        mockMvc
            .perform(get("/api/v1/approvals").param("status", "PENDING"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    long pendingBaseline = objectMapper.readTree(pendingBaselineJson).path("total").asLong();

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
    Assertions.assertEquals(approvalBaseline + 1, approvalRepository.count());

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

    // 按状态过滤 PENDING 回到基线（本测试两张都终态了；其他测试的 PENDING 单不受影响）
    mockMvc
        .perform(get("/api/v1/approvals").param("status", "PENDING"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(pendingBaseline));

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

  @Test
  void requirementCenterLifecycleDedupeAndTerminalProtection() throws Exception {
    // 登记需求
    String created =
        mockMvc
            .perform(
                post("/api/v1/requirements")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "requirementType": "DATA",
                          "title": "客户主数据补全",
                          "description": "补全缺失字段并回填历史数据",
                          "requester": "alice"
                        }
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.startsWith("req-")))
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    // 同类型同归一化标题（带多余空白）的非终态重复登记 → 409 去重
    mockMvc
        .perform(
            post("/api/v1/requirements")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "requirementType": "DATA",
                      "title": "  客户主数据补全  ",
                      "requester": "bob"
                    }
                    """))
        .andExpect(status().isConflict());

    // 计划调整（OPEN 阶段允许）
    mockMvc
        .perform(
            put("/api/v1/requirements/{code}/plan", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":{\"milestone\":\"M4\",\"owner\":\"carol\"}}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.plan.milestone").value("M4"));

    // 分析 → 分派（平台内软件 + 引用编码 + 分派时计划）
    mockMvc
        .perform(post("/api/v1/requirements/{code}/analyze", code))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ANALYZING"));
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/assign", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "assigneeSystem": "data-platform",
                      "assigneeRef": "task-100",
                      "plan": {"milestone": "M4", "owner": "dave"}
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ASSIGNED"))
        .andExpect(jsonPath("$.assigneeSystem").value("data-platform"))
        .andExpect(jsonPath("$.assigneeRef").value("task-100"));

    // 分派后不允许再调整计划 → 409
    mockMvc
        .perform(
            put("/api/v1/requirements/{code}/plan", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plan\":{\"milestone\":\"M5\"}}"))
        .andExpect(status().isConflict());

    // 分派目标必须平台内业务软件 → 400
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/assign", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assigneeSystem\":\"unknown-system\"}"))
        .andExpect(status().isBadRequest());

    // 进行中 → 完成（结项说明必填）
    mockMvc
        .perform(post("/api/v1/requirements/{code}/progress", code))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/complete", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"\"}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/complete", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"数据回填完成并验收\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.closedNote").value("数据回填完成并验收"));

    // 终态防重：完成后再流转/再完成 → 409
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/complete", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"再完成一次\"}"))
        .andExpect(status().isConflict());

    // 第二条需求：取消分支（OPEN 直接取消）
    String second =
        mockMvc
            .perform(
                post("/api/v1/requirements")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "requirementType": "ALGORITHM",
                          "title": "实时风控指标加工",
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
            post("/api/v1/requirements/{code}/cancel", secondCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"业务范围调整\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CANCELED"));
    mockMvc
        .perform(
            post("/api/v1/requirements/{code}/cancel", secondCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closedNote\":\"重复取消\"}"))
        .andExpect(status().isConflict());

    // 过滤：状态与类型
    mockMvc
        .perform(get("/api/v1/requirements").param("status", "COMPLETED"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].code").value(code));
    mockMvc
        .perform(get("/api/v1/requirements").param("type", "ALGORITHM"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].code").value(secondCode));
    mockMvc
        .perform(get("/api/v1/requirements").param("keyword", "客户主数据"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));

    // 详情与不存在
    mockMvc
        .perform(get("/api/v1/requirements/{code}", code))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assigneeRef").value("task-100"));
    mockMvc.perform(get("/api/v1/requirements/req-deadbeef")).andExpect(status().isNotFound());
  }

  @Test
  void operationsCenterNoticesFeedbacksAndStatistics() throws Exception {
    // 公告：草稿 → 发布（带 publishedAt）→ 归档，单向流转
    String noticeJson =
        mockMvc
            .perform(
                post("/api/v1/operations/notices")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "title": "M4 门户上线公告",
                          "content": "管理门户三中心与业务模块已上线。",
                          "section": "announcement"
                        }
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.startsWith("ntc-")))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String noticeCode = objectMapper.readTree(noticeJson).path("code").asText();

    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/publish", noticeCode))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PUBLISHED"))
        .andExpect(jsonPath("$.publishedAt").exists());

    // 重复发布 → 409（单向状态机）
    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/publish", noticeCode))
        .andExpect(status().isConflict());

    // 第二条公告保持草稿，验证公开列表默认不可见草稿
    mockMvc
        .perform(
            post("/api/v1/operations/notices")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "title": "草稿公告",
                      "content": "尚未发布。",
                      "section": "announcement"
                    }
                    """))
        .andExpect(status().isCreated());

    mockMvc
        .perform(get("/api/v1/operations/notices"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].code").value(noticeCode));
    mockMvc
        .perform(get("/api/v1/operations/notices").param("status", "DRAFT"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));

    // 归档后重复归档 → 409
    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/archive", noticeCode))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ARCHIVED"));
    mockMvc
        .perform(post("/api/v1/operations/notices/{code}/archive", noticeCode))
        .andExpect(status().isConflict());

    // 反馈：待处理 → 已处理（说明必填），重复处理 409
    String feedbackJson =
        mockMvc
            .perform(
                post("/api/v1/operations/feedbacks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "title": "数据商城没有搜索入口",
                          "content": "希望增加全文检索。",
                          "contact": "alice@example.com"
                        }
                        """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.startsWith("fb-")))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String feedbackCode = objectMapper.readTree(feedbackJson).path("code").asText();

    mockMvc
        .perform(
            post("/api/v1/operations/feedbacks/{code}/handle", feedbackCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"handleNote\":\"\"}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            post("/api/v1/operations/feedbacks/{code}/handle", feedbackCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"handleNote\":\"已排期 M4.3 增加搜索\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("HANDLED"))
        .andExpect(jsonPath("$.handledAt").exists());
    mockMvc
        .perform(
            post("/api/v1/operations/feedbacks/{code}/handle", feedbackCode)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"handleNote\":\"重复处理\"}"))
        .andExpect(status().isConflict());

    // 运营统计与登记数据一致：公告 2 条（1 条已归档，公开 0）、反馈待处理 0
    mockMvc
        .perform(get("/api/v1/operations/statistics"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.noticeTotal").value(2))
        .andExpect(jsonPath("$.publishedNotices").value(0))
        .andExpect(jsonPath("$.pendingFeedbacks").value(0));

    // 不存在
    mockMvc
        .perform(get("/api/v1/operations/notices/ntc-deadbeef"))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(get("/api/v1/operations/feedbacks/fb-deadbeef"))
        .andExpect(status().isNotFound());
  }

  @Test
  void personalCenterAggregatesMyItemsAndTodos() throws Exception {
    // 基线（跨测试共享内存库，其他测试也产生 alice 的需求/审批）
    String baselineJson =
        mockMvc
            .perform(get("/api/v1/personal/todos").param("requester", "carol"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    com.fasterxml.jackson.databind.JsonNode baseline = objectMapper.readTree(baselineJson);

    // carol 提一条需求、一条审批申请
    mockMvc
        .perform(
            post("/api/v1/requirements")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "requirementType": "DATA",
                      "title": "carol 的数据补全需求",
                      "requester": "carol"
                    }
                    """))
        .andExpect(status().isCreated());
    mockMvc
        .perform(
            post("/api/v1/approvals")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "approvalType": "DATA_GRANT",
                      "sourceSystem": "data-platform",
                      "title": "carol 的数据授权申请",
                      "requester": "carol"
                    }
                    """))
        .andExpect(status().isCreated());

    // 待办统计：carol 新增 1 条 PENDING 审批、1 条 OPEN 需求、需求/申请总数各 +1
    mockMvc
        .perform(get("/api/v1/personal/todos").param("requester", "carol"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.pendingApprovalCount")
                .value(baseline.path("pendingApprovalCount").asLong() + 1))
        .andExpect(
            jsonPath("$.myOpenRequirementCount")
                .value(baseline.path("myOpenRequirementCount").asLong() + 1))
        .andExpect(
            jsonPath("$.myRequirementCount")
                .value(baseline.path("myRequirementCount").asLong() + 1))
        .andExpect(
            jsonPath("$.myApprovalCount").value(baseline.path("myApprovalCount").asLong() + 1));

    // 我的需求：按提出人过滤，carol 恰好 +1（标题包含 carol 标记，防同标题去重误伤）
    String myRequirementsJson =
        mockMvc
            .perform(get("/api/v1/personal/requirements").param("requester", "carol"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    Assertions.assertEquals(
        baseline.path("myRequirementCount").asLong() + 1,
        objectMapper.readTree(myRequirementsJson).path("total").asLong(),
        "我的需求只统计 carol 提出的需求");

    // 我的申请：按申请人过滤
    String myApprovalsJson =
        mockMvc
            .perform(get("/api/v1/personal/approvals").param("requester", "carol"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    Assertions.assertEquals(
        baseline.path("myApprovalCount").asLong() + 1,
        objectMapper.readTree(myApprovalsJson).path("total").asLong(),
        "我的申请只统计 carol 提交的审批单");

    // 状态过滤：carol 的 PENDING 需求 1 条（新增的那条）
    mockMvc
        .perform(
            get("/api/v1/personal/requirements")
                .param("requester", "carol")
                .param("status", "OPEN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(baseline.path("myOpenRequirementCount").asLong() + 1));

    // 用户缺失 → 400
    mockMvc.perform(get("/api/v1/personal/todos")).andExpect(status().isBadRequest());
  }
}
