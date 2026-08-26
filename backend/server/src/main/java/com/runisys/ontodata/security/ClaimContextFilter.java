package com.runisys.ontodata.security;

import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.TenantContextFilter;
import com.runisys.ontodata.security.OidcClaimMapping.IdentityClaims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 身份上下文过滤器（M5 IAM）：认证完成后从令牌 claim 装载租户/组织/项目/密级上下文。
 *
 * <p>仅当 {@code ontodata.security.oauth2.enabled=true}（缺省即安全模式）时注册；Order(10) 保证运行在 Spring Security
 * 过滤器链（-100）之后——身份已由 JWT 校验。与 TenantContextFilter 互斥：安全模式下请求头装载 过滤器不注册，显式 X-Tenant-Id
 * 等头不会成为事实来源（claims 唯一权威）。 缺少租户 claim 视为不可信身份，403 拒绝。
 */
@Component
@ConditionalOnProperty(name = "ontodata.security.oauth2.enabled", havingValue = "true")
@Order(10)
public class ClaimContextFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null
        || !authentication.isAuthenticated()
        || authentication instanceof AnonymousAuthenticationToken) {
      // 放行端点（健康检查等）无身份：直接继续链路（受保护端点已被 Security 链 401 拦截，不会走到这里）
      filterChain.doFilter(request, response);
      return;
    }
    IdentityClaims claims = OidcClaimMapping.from(authentication);
    if (claims == null) {
      response.setStatus(HttpServletResponse.SC_FORBIDDEN);
      response.setContentType("application/json;charset=UTF-8");
      response
          .getWriter()
          .write(
              "{\"status\":403,\"code\":\"ACCESS_DENIED\","
                  + "\"message\":\"身份缺少租户声明（tenant_id），拒绝访问\",\"path\":\""
                  + request.getRequestURI()
                  + "\"}");
      return;
    }
    TenantContext.set(claims.tenantId());
    PermissionContext.set(claims.orgId(), claims.projectId(), claims.clearance());
    // S2 迁移桥接：SDK OutboxEvent 构造读取 TenantProjectContext（硬边界），
    // 与旧上下文同步装载/清理；安全模式租户来自已验证 claim，必非空
    com.runisys.ontodata.sdk.context.TenantProjectContext.populate(
        claims.tenantId(), claims.projectId(), null,
        com.runisys.ontodata.sdk.context.TenantProjectContext.Classification.INTERNAL, false);
    MDC.put(TenantContextFilter.MDC_KEY, claims.tenantId());
    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove(TenantContextFilter.MDC_KEY);
      com.runisys.ontodata.sdk.context.TenantProjectContext.clear();
      TenantContext.clear();
      PermissionContext.clear();
    }
  }
}
