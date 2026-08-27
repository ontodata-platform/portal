package com.runisys.ontodata;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.scenariocenter.application.ScenarioReferenceChecker;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 场景编排器端到端（批次 D 后段）：CRUD + 发布/下线状态机 + 钉扎校验正负例 + 租户隔离。
 *
 * <p>引用存在性回查（{@link ScenarioReferenceChecker}）以 MockBean 替身——fail-closed 行为由 {@link
 * PortalScenarioReferenceCheckIntegrationTest} 以真实 HTTP 装配覆盖。 独立 H2 内存库，避免与其他集成测试交叉污染。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties =
        "spring.datasource.url=jdbc:h2:mem:portal_scenario_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
class PortalScenarioIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @MockBean private ScenarioReferenceChecker referenceChecker;

  private static final String VALID_BODY =
      """
      {"name":"客户数据质量分析场景","description":"订阅客户主数据快照并运行质量检测",
       "projectId":"quality-demo",
       "ontologyRefs":[{"packageCode":"pkg-customer-mdm","version":"2.1.0"}],
       "bindings":[
         {"type":"DATA_SNAPSHOT","ref":"snap-customer-master-20260801","version":"3.0.0","alias":"customerData","sourceSystem":"DATA_PLATFORM"},
         {"type":"CAPABILITY","ref":"cap-null-check","version":"1.4.0","alias":"nullChecker","sourceSystem":"ALGORITHM_TRANSFORM"},
         {"type":"WORKFLOW_TEMPLATE","ref":"wft-quality-pipeline","version":"2.0.0","alias":"qualityFlow","sourceSystem":"ALGORITHM_RECOMBINE"}],
       "presentation":{"entryView":"scenario-overview","widgets":[
         {"kind":"METRIC","bindingAlias":"customerData","config":{"metric":"row_count"}}]},
       "createdBy":"user-wangpipi"}
      """;

  @Test
  void crudAndLifecycleFollowImmutableVersionConvention() throws Exception {
    // 创建：服务端生成 scn-* 编码，初始 1.0.0 草稿
    String created =
        mockMvc
            .perform(
                post("/api/v1/scenarios")
                    .header("X-Tenant-Id", "tenant-a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_BODY))
            .andExpect(status().isCreated())
            .andExpect(
                jsonPath("$.code")
                    .value(org.hamcrest.Matchers.matchesPattern("^scn-[a-z0-9-]{1,64}$")))
            .andExpect(jsonPath("$.version").value("1.0.0"))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.bindings.length()").value(3))
            .andExpect(jsonPath("$.tenantId").value("tenant-a"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    // 草稿可改
    mockMvc
        .perform(
            put("/api/v1/scenarios/{code}/versions/1.0.0", code)
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY.replace("客户数据质量分析场景", "客户数据质量分析场景 v2")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("客户数据质量分析场景 v2"));

    // 发布：DRAFT → PUBLISHED，发布前回查引用存在性
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PUBLISHED"));
    verify(referenceChecker).checkAll(anyList());

    // 发布不可变：PUT 与重复发布 409
    mockMvc
        .perform(
            put("/api/v1/scenarios/{code}/versions/1.0.0", code)
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY))
        .andExpect(status().isConflict());
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isConflict());

    // 修改走新草稿版本：派生 1.0.1 草稿，内容整组复制
    mockMvc
        .perform(post("/api/v1/scenarios/{code}/drafts", code).header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.version").value("1.0.1"))
        .andExpect(jsonPath("$.status").value("DRAFT"))
        .andExpect(jsonPath("$.bindings.length()").value(3));

    // 详情默认返回最高版本；指定版本仍可回查
    mockMvc
        .perform(get("/api/v1/scenarios/{code}", code).header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value("1.0.1"));
    mockMvc
        .perform(
            get("/api/v1/scenarios/{code}/versions/1.0.0", code).header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PUBLISHED"));

    // 下线：PUBLISHED → DEPRECATED；终态防重
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/deprecate", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DEPRECATED"));
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/deprecate", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isConflict());
  }

  @Test
  void pinningValidationRejectsLatestAndWildcard() throws Exception {
    // 契约负例 bad-latest-pin：bindings[].version=latest → 400
    mockMvc
        .perform(
            post("/api/v1/scenarios")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"非法钉扎","bindings":[
                      {"type":"WORKFLOW_TEMPLATE","ref":"wft-quality-pipeline","version":"latest","alias":"flow","sourceSystem":"ALGORITHM_RECOMBINE"}]}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

    // 契约负例 bad-latest-ontology-ref：ontologyRefs[].version=latest → 400
    mockMvc
        .perform(
            post("/api/v1/scenarios")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"非法本体钉扎",
                     "ontologyRefs":[{"packageCode":"pkg-customer-mdm","version":"latest"}],
                     "bindings":[
                       {"type":"DATA_SNAPSHOT","ref":"snap-a","version":"3.0.0","alias":"data","sourceSystem":"DATA_PLATFORM"}]}
                    """))
        .andExpect(status().isBadRequest());

    // 通配符同样拒绝
    mockMvc
        .perform(
            post("/api/v1/scenarios")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"通配钉扎","bindings":[
                      {"type":"CAPABILITY","ref":"cap-null-check","version":"1.x","alias":"checker","sourceSystem":"ALGORITHM_TRANSFORM"}]}
                    """))
        .andExpect(status().isBadRequest());

    // bindings 至少一条；widget 别名必须指向已声明绑定
    mockMvc
        .perform(
            post("/api/v1/scenarios")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"空绑定\",\"bindings\":[]}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            post("/api/v1/scenarios")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"悬空别名","bindings":[
                       {"type":"DATA_SNAPSHOT","ref":"snap-a","version":"3.0.0","alias":"data","sourceSystem":"DATA_PLATFORM"}],
                     "presentation":{"widgets":[{"kind":"TABLE","bindingAlias":"ghost"}]}}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
  }

  @Test
  void scenariosAreTenantIsolated() throws Exception {
    String created =
        mockMvc
            .perform(
                post("/api/v1/scenarios")
                    .header("X-Tenant-Id", "tenant-a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_BODY))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    // tenant-b：列表不可见、find 404、流转 404
    mockMvc
        .perform(get("/api/v1/scenarios").header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/scenarios/{code}", code).header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isNotFound());

    // tenant-a 可见；缺省头 = default 租户互不可见
    mockMvc
        .perform(get("/api/v1/scenarios").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    mockMvc.perform(get("/api/v1/scenarios/{code}", code)).andExpect(status().isNotFound());
  }
}
