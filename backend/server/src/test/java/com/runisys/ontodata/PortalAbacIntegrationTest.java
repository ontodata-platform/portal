package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * ABAC 端到端（M5）：租户×组织×项目×数据密级。
 *
 * <p>验收：结果携带数据密级（缺省 PUBLIC）；主体许可密级（X-Clearance-Level，缺省 INTERNAL） 必须 ≥ 资源密级——不足时列表过滤（不泄露存在性）、详情
 * 403（明确拒绝）；租户隔离优先于 密级判定（跨租户即使高许可也 404）；组织/项目请求头格式校验（非法 400）。独立 H2 内存库。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties =
        "spring.datasource.url=jdbc:h2:mem:portal_abac_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
class PortalAbacIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void classificationGuardsResultAccess() throws Exception {
    // tenant-a：PUBLIC（缺省）与 CONFIDENTIAL 两条结果
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/ds-public")
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"resultType\":\"DATASET\",\"resourceRefs\":[],\"metadata\":{}}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.classification").value("PUBLIC"));
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/ds-confidential")
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"resultType":"DATASET","resourceRefs":[],"metadata":{},"classification":"CONFIDENTIAL"}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.classification").value("CONFIDENTIAL"));

    // 缺省许可 INTERNAL：列表只见 PUBLIC（不泄露高密级存在性）
    mockMvc
        .perform(get("/api/v1/results").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].resultId").value("ds-public"));

    // 详情：许可不足 403（明确拒绝）
    mockMvc
        .perform(
            get("/api/v1/results/data-platform/ds-confidential").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isForbidden());

    // 高许可 SECRET：列表两条可见、详情 200
    mockMvc
        .perform(
            get("/api/v1/results")
                .header("X-Tenant-Id", "tenant-a")
                .header("X-Clearance-Level", "SECRET"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(2));
    mockMvc
        .perform(
            get("/api/v1/results/data-platform/ds-confidential")
                .header("X-Tenant-Id", "tenant-a")
                .header("X-Clearance-Level", "SECRET"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.classification").value("CONFIDENTIAL"));

    // 租户隔离优先于密级：跨租户即使 SECRET 也 404
    mockMvc
        .perform(
            get("/api/v1/results/data-platform/ds-confidential")
                .header("X-Tenant-Id", "tenant-b")
                .header("X-Clearance-Level", "SECRET"))
        .andExpect(status().isNotFound());

    // 非法许可密级头 400
    mockMvc
        .perform(
            get("/api/v1/results")
                .header("X-Tenant-Id", "tenant-a")
                .header("X-Clearance-Level", "TOP-SECRET"))
        .andExpect(status().isBadRequest());

    // 非法登记密级 400
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/ds-bad")
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"resultType":"DATASET","resourceRefs":[],"metadata":{},"classification":"BOGUS"}
                    """))
        .andExpect(status().isBadRequest());
  }

  @Test
  void orgAndProjectHeadersAreValidated() throws Exception {
    // 合法组织/项目头：请求正常处理
    mockMvc
        .perform(
            get("/api/v1/results")
                .header("X-Tenant-Id", "tenant-a")
                .header("X-Org-Id", "org-1")
                .header("X-Project-Id", "project-1"))
        .andExpect(status().isOk());

    // 非法组织标识 400
    mockMvc
        .perform(
            get("/api/v1/results").header("X-Tenant-Id", "tenant-a").header("X-Org-Id", "BAD ORG!"))
        .andExpect(status().isBadRequest());

    // 非法项目标识 400
    mockMvc
        .perform(
            get("/api/v1/results")
                .header("X-Tenant-Id", "tenant-a")
                .header("X-Project-Id", "BAD PROJECT!"))
        .andExpect(status().isBadRequest());
  }
}
