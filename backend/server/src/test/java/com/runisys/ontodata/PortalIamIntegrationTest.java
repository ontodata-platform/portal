package com.runisys.ontodata;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * IAM 端到端（M5）：OIDC Bearer JWT（resource server）模式下身份 claim → 租户/密级上下文。
 *
 * <p>验收：无令牌 401（健康检查放行）；租户从 claim 装载（跨租户隔离随身份生效）；密级 claim 参与 ABAC （SECRET 可读 CONFIDENTIAL，缺省
 * INTERNAL 403）；显式 X-Tenant-Id 头被忽略（claims 优先）； 缺租户 claim 视为不可信身份 403。独立 H2 内存库；JWT 解码用桩（身份由测试
 * jwt() 后处理器注入）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = {
      "ontodata.security.oauth2.enabled=true",
      "spring.datasource.url=jdbc:h2:mem:portal_iam_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
    })
class PortalIamIntegrationTest {

  @Autowired private MockMvc mockMvc;

  /** IAM 测试桩解码器：不做真实 JWK 校验（身份由测试 jwt() 后处理器注入，解码器不被调用）。 */
  @TestConfiguration
  static class StubJwtDecoder {

    @Bean
    JwtDecoder jwtDecoder() {
      return token -> Jwt.withTokenValue("stub").header("alg", "none").subject("tester").build();
    }
  }

  /** 构造携带租户/密级 claim 的令牌后处理器（tenantId 为 null 时模拟缺租户 claim）。 */
  private static RequestPostProcessor tenantToken(String tenantId, String clearance) {
    return jwt()
        .jwt(
            builder -> {
              builder.subject("tester");
              if (tenantId != null) {
                builder.claim("tenant_id", tenantId);
              }
              if (clearance != null) {
                builder.claim("clearance", clearance);
              }
            });
  }

  @Test
  void unauthenticatedRequestIsRejectedWhileHealthIsOpen() throws Exception {
    mockMvc.perform(get("/api/v1/tasks")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/v1/retention/status")).andExpect(status().isUnauthorized());
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  void tenantFromClaimsScopesAllData() throws Exception {
    mockMvc
        .perform(
            put("/api/v1/tasks/task-iam")
                .with(tenantToken("tenant-a", null))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"taskId":"task-iam","taskType":"DATA_INGEST","sourceSystem":"data-platform",
                     "status":"RUNNING","progress":10,"resourceRefs":[],"resultRefs":[]}
                    """))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/v1/tasks").with(tenantToken("tenant-a", null)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    // 同一服务端，令牌租户不同 → 完全隔离
    mockMvc
        .perform(get("/api/v1/tasks").with(tenantToken("tenant-b", null)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/tasks/task-iam").with(tenantToken("tenant-b", null)))
        .andExpect(status().isNotFound());
  }

  @Test
  void clearanceClaimParticipatesInAbac() throws Exception {
    mockMvc
        .perform(
            put("/api/v1/results/data-platform/iam-confidential")
                .with(tenantToken("tenant-a", "SECRET"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"resultType":"DATASET","resourceRefs":[],"metadata":{},"classification":"CONFIDENTIAL"}
                    """))
        .andExpect(status().isOk());

    // 缺省许可 INTERNAL：403；SECRET：200
    mockMvc
        .perform(
            get("/api/v1/results/data-platform/iam-confidential")
                .with(tenantToken("tenant-a", null)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            get("/api/v1/results/data-platform/iam-confidential")
                .with(tenantToken("tenant-a", "SECRET")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.classification").value("CONFIDENTIAL"));
  }

  @Test
  void explicitTenantHeaderIsIgnoredInIamMode() throws Exception {
    // 令牌 claim 是 tenant-a，请求头写 tenant-b：claims 优先，数据必须落 tenant-a
    mockMvc
        .perform(
            put("/api/v1/tasks/task-header")
                .with(tenantToken("tenant-a", null))
                .header("X-Tenant-Id", "tenant-b")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"taskId":"task-header","taskType":"DATA_INGEST","sourceSystem":"data-platform",
                     "status":"RUNNING","progress":10,"resourceRefs":[],"resultRefs":[]}
                    """))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/api/v1/tasks").with(tenantToken("tenant-b", null)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
  }

  @Test
  void identityWithoutTenantClaimIsRejected() throws Exception {
    mockMvc
        .perform(get("/api/v1/tasks").with(tenantToken(null, null)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
  }
}
