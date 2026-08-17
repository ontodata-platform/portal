package com.runisys.ontodata;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 投影重建端点安全语义（WP-03）：POST /api/v1/projections/rebuild 是管理操作——
 *
 * <ol>
 *   <li>安全模式（默认）下必须认证：无令牌 401；
 *   <li>事件总线未启用（ontodata.events.kafka.enabled=false，本测试环境）时拒绝执行（409）， 不允许"静默成功"的假重建。
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties = {
      "ontodata.security.oauth2.enabled=true",
      "spring.datasource.url=jdbc:h2:mem:portal_rebuild_sec_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
    })
class PortalProjectionRebuildSecurityTest {

  @Autowired private MockMvc mockMvc;

  /** IAM 测试桩解码器：身份由测试 jwt() 后处理器注入（同 PortalIamIntegrationTest）。 */
  @TestConfiguration
  static class StubJwtDecoder {

    @Bean
    JwtDecoder jwtDecoder() {
      return token -> Jwt.withTokenValue("stub").header("alg", "none").subject("tester").build();
    }
  }

  @Test
  void rebuildRequiresAuthenticationInSecureMode() throws Exception {
    // 无令牌：401（安全模式 anyRequest().authenticated() 覆盖，重建端点不在放行白名单）
    mockMvc.perform(post("/api/v1/projections/rebuild")).andExpect(status().isUnauthorized());

    // 有令牌但总线未启用：明确 409 拒绝（错误协议 STATE_CONFLICT），不静默成功
    mockMvc
        .perform(
            post("/api/v1/projections/rebuild")
                .with(jwt().jwt(builder -> builder.subject("tester").claim("tenant_id", "t-1"))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
  }
}
