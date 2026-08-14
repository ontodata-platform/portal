package com.runisys.ontodata.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 安全过滤器链（M5 IAM）：按 {@code ontodata.security.oauth2.enabled} 切换两种模式。
 *
 * <ul>
 *   <li><b>关闭（缺省）</b>：全部放行——租户/组织/项目/密级由 TenantContextFilter 从显式请求头装载 （开发/演示环境；生产严禁此模式）；
 *   <li><b>启用</b>：OIDC Bearer JWT 认证（stateless resource server），健康检查放行，其余端点 必须携带令牌；租户等上下文由
 *       ClaimContextFilter 从 claim 装载（显式请求头被忽略）。
 * </ul>
 */
@Configuration
public class SecurityConfiguration {

  /** IAM 关闭（缺省）：全部放行，显式头模式。 */
  @Bean
  @ConditionalOnProperty(
      name = "ontodata.security.oauth2.enabled",
      havingValue = "false",
      matchIfMissing = true)
  SecurityFilterChain openChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    return http.build();
  }

  /** IAM 启用：JWT resource server + 无状态会话。 */
  @Bean
  @ConditionalOnProperty(name = "ontodata.security.oauth2.enabled", havingValue = "true")
  SecurityFilterChain secureChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health", "/actuator/info")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(resourceServer -> resourceServer.jwt(Customizer.withDefaults()));
    return http.build();
  }

  /**
   * 从授权服务器 JWK 集解码 JWT：仅当启用 IAM 且配置了 issuer-uri 时注册（测试可自行提供桩 JwtDecoder，不与本 bean 冲突）。IAM 启用但未配置
   * issuer-uri 时无解码器，Security 链 初始化即失败——拒绝半配置运行。
   */
  @Bean
  @ConditionalOnExpression(
      "'${ontodata.security.oauth2.enabled:false}' == 'true'"
          + " and '${spring.security.oauth2.resourceserver.jwt.issuer-uri:}' != ''")
  JwtDecoder jwtDecoder(
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri) {
    return NimbusJwtDecoder.withIssuerLocation(issuerUri).build();
  }
}
