package com.runisys.ontodata.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * 安全过滤器链（M5 IAM / WP-02 身份底座）：按 {@code ontodata.security.oauth2.enabled} 切换两种模式。
 *
 * <p><b>默认即安全</b>：属性缺省（或显式 true）时走 {@link #secureChain}——这是唯一允许进入生产的形态； 只有<b>显式</b>配置 {@code
 * enabled=false} 才退回 {@link #openChain} 开发模式。
 *
 * <ul>
 *   <li><b>启用（缺省，生产形态）</b>：OIDC Bearer JWT 认证（stateless resource server），仅放行
 *       /actuator/health、/actuator/info、/actuator/prometheus（指标端点供集群内 Prometheus 抓取，网络层由
 *       NetworkPolicy/内网收敛，不对公网暴露），其余端点必须携带有效令牌；租户/组织/项目/密级上下文由 ClaimContextFilter 从已验证令牌的 claim
 *       装载（此时 TenantContextFilter 不注册，显式 X-Tenant-Id 等请求头不作为事实来源）；
 *   <li><b>关闭（显式 enabled=false，仅限本地开发/演示）</b>：全部请求匿名放行，租户等上下文由 TenantContextFilter
 *       从可伪造的请求头装载——身份没有任何真实性保证，严禁用于生产； 启动时打印 WARN 日志醒目提示。
 * </ul>
 */
@Configuration
public class SecurityConfiguration {

  private static final Logger log = LoggerFactory.getLogger(SecurityConfiguration.class);

  /**
   * 开发模式（仅限显式 {@code enabled=false}）：全部放行，显式头模式。
   *
   * <p>用途边界：仅用于本地无 IdP 环境下的功能开发/演示，让开发者不必起 Keycloak 即可调通接口； 由于 X-Tenant-Id
   * 等头可任意伪造，此模式下不存在任何身份与隔离保证，<b>严禁用于生产</b>。 属性缺省时<b>不会</b>进入本模式——缺省即安全（secureChain）。
   */
  @Bean
  @ConditionalOnProperty(name = "ontodata.security.oauth2.enabled", havingValue = "false")
  SecurityFilterChain openChain(HttpSecurity http) throws Exception {
    // 醒目告警：让"跑在裸奔模式"这件事在日志里一眼可见，防止误带进生产环境
    log.warn("当前为开发模式（ontodata.security.oauth2.enabled=false），所有请求匿名放行，严禁用于生产");
    http.csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    return http.build();
  }

  /**
   * 安全模式（缺省生效，matchIfMissing=true）：JWT resource server + 无状态会话。
   *
   * <p>用途边界：生产及一切联调/测试环境的唯一合法形态；未配置 issuer-uri 时启动即失败 （见 {@link #jwtDecoder}），拒绝半配置运行——宁可起不来，也不裸奔。
   */
  @Bean
  @ConditionalOnProperty(
      name = "ontodata.security.oauth2.enabled",
      havingValue = "true",
      matchIfMissing = true)
  SecurityFilterChain secureChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                // /actuator/prometheus 为 WP-09 新增的指标端点：供集群内 Prometheus 抓取，
                // 网络层由 NetworkPolicy/内网收敛，不对公网暴露，故随 health/info 一并匿名放行
                auth.requestMatchers("/actuator/health", "/actuator/info", "/actuator/prometheus")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(resourceServer -> resourceServer.jwt(Customizer.withDefaults()));
    return http.build();
  }

  /**
   * 从授权服务器 JWK 集解码 JWT：仅当安全模式生效（缺省即生效）且配置了 issuer-uri 时注册（测试可自行提供桩 JwtDecoder，不与本 bean 冲突）。安全模式下未配置
   * issuer-uri 时无解码器，Security 链 初始化即失败——拒绝半配置运行。
   */
  @Bean
  @ConditionalOnExpression(
      "'${ontodata.security.oauth2.enabled:true}' == 'true'"
          + " and '${spring.security.oauth2.resourceserver.jwt.issuer-uri:}' != ''")
  JwtDecoder jwtDecoder(
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri) {
    return NimbusJwtDecoder.withIssuerLocation(issuerUri).build();
  }
}
