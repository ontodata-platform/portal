package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * WP-02 默认安全断言：不设置 {@code ontodata.security.oauth2.enabled}（也不激活会显式关闭它的 test
 * profile），应用必须按安全模式装配——受保护端点无令牌 401、健康检查放行。
 *
 * <p>与 PortalIamIntegrationTest 的差别：那里显式 enabled=true，验证安全模式行为；这里什么都不设， 验证"默认配置即安全模式"这一翻转本身不回退。独立
 * H2 内存库（不经 test profile，数据源属性需内联提供）； JWT 解码用桩（本测试不携带令牌，解码器不会被调用，仅为满足 resource server 装配）。
 */
@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:portal_secure_default_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.jpa.hibernate.ddl-auto=none",
      "spring.flyway.enabled=true"
    })
@AutoConfigureMockMvc
// WP-09：Boot 测试默认禁用指标导出（management.defaults.metrics.export.enabled=false，
// 优先级高于内联属性），显式 metrics=true 才能验证 /actuator/prometheus 端到端匿名可达
@AutoConfigureObservability(metrics = true)
class PortalSecureByDefaultIntegrationTest {

  @Autowired private MockMvc mockMvc;

  /** 桩解码器：本测试不携带令牌，解码器不会被调用，仅为满足 resource server 装配。 */
  @TestConfiguration
  static class StubJwtDecoder {

    @Bean
    JwtDecoder jwtDecoder() {
      return token -> Jwt.withTokenValue("stub").header("alg", "none").subject("tester").build();
    }
  }

  @Test
  void protectedEndpointsRejectAnonymousByDefault() throws Exception {
    // 未设置 ontodata.security.oauth2.enabled：缺省即安全模式，无令牌必须 401
    mockMvc.perform(get("/api/v1/tasks")).andExpect(status().isUnauthorized());
    // 显式头不能冒充身份：安全模式下请求头不是事实来源，依旧 401
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isUnauthorized());
    // 健康检查保持放行（监控探活不依赖令牌）
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    // WP-09：指标端点同样匿名放行——供集群内 Prometheus 抓取，网络层收敛不对公网暴露
    mockMvc.perform(get("/actuator/prometheus")).andExpect(status().isOk());
  }
}
