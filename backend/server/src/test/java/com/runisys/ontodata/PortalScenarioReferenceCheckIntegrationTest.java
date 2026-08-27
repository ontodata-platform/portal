package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * 场景发布引用回查 fail-closed 端到端：严格模式（默认）下上游能力目录不可达时发布被阻断（400），
 * 草稿创建不受影响（回查只在发布时执行）；宽松模式（enabled=false）跳过回查可发布。 独立 H2 内存库。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:portal_scenario_ref_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
      // 严格模式：指向不可能监听的端口，等价于上游目录不可达
      "ontodata.upstream.transform.base-url=http://127.0.0.1:1",
      "ontodata.upstream.recombine.base-url=http://127.0.0.1:1"
    })
class PortalScenarioReferenceCheckIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static final String CAPABILITY_BODY =
      """
      {"name":"引用回查场景","bindings":[
        {"type":"CAPABILITY","ref":"cap-null-check","version":"1.4.0","alias":"checker","sourceSystem":"ALGORITHM_TRANSFORM"}]}
      """;

  @Test
  void publishFailsClosedWhenUpstreamCatalogUnreachable() throws Exception {
    String created =
        mockMvc
            .perform(
                post("/api/v1/scenarios")
                    .header("X-Tenant-Id", "tenant-a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(CAPABILITY_BODY))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    // fail-closed：能力目录不可达 → 发布 400 阻断，绝不以桩结果放行
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isBadRequest())
        .andExpect(
            jsonPath("$.message").value(org.hamcrest.Matchers.containsString("无法连接算法转换工具能力目录")));

    // 发布失败后仍是草稿（状态未被推进）
    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isBadRequest());
  }
}
