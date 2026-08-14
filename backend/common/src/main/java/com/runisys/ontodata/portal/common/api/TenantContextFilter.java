package com.runisys.ontodata.portal.common.api;

import com.runisys.ontodata.portal.common.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 租户上下文过滤器（M5 多租户基础）：从 X-Tenant-Id 请求头装载请求级租户上下文， 同步写入 MDC（日志按租户检索）。缺省 default；非法格式拒绝 400（租户标识
 * 只允许小写字母/数字/连字符，IAM 接入后租户来自认证上下文）。
 */
@Component
@Order(1)
public class TenantContextFilter extends OncePerRequestFilter {

  public static final String MDC_KEY = "tenantId";

  private static final Pattern TENANT_PATTERN = Pattern.compile("^[a-z0-9\\-]{1,64}$");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String tenantId = request.getHeader(TenantContext.HEADER);
    if (tenantId == null || tenantId.isBlank()) {
      tenantId = TenantContext.DEFAULT_TENANT;
    }
    if (!TENANT_PATTERN.matcher(tenantId).matches()) {
      response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
      response.setContentType("application/json;charset=UTF-8");
      response
          .getWriter()
          .write(
              "{\"status\":400,\"code\":\"VALIDATION_FAILED\","
                  + "\"message\":\"租户标识格式不正确\",\"path\":\""
                  + request.getRequestURI()
                  + "\"}");
      return;
    }
    TenantContext.set(tenantId);
    MDC.put(MDC_KEY, tenantId);
    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
      TenantContext.clear();
    }
  }
}
