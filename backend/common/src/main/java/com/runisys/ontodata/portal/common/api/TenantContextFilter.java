package com.runisys.ontodata.portal.common.api;

import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.security.DataClassification;
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
 * 请求级上下文过滤器（M5 多租户 + ABAC 基础）：从请求头装载租户（X-Tenant-Id）、
 * 组织（X-Org-Id）、项目（X-Project-Id）与许可密级（X-Clearance-Level）， 租户同步写入 MDC（日志按租户检索）。
 *
 * <p>校验规则：租户/组织/项目只允许小写字母/数字/连字符（1-64 位，组织与项目缺省为 空）；密级只允许 PUBLIC/INTERNAL/CONFIDENTIAL/SECRET（缺省
 * INTERNAL）；非法值拒绝 400（IAM 接入后这些属性来自认证上下文）。
 */
@Component
@Order(1)
public class TenantContextFilter extends OncePerRequestFilter {

  public static final String MDC_KEY = "tenantId";

  private static final Pattern IDENTIFIER_PATTERN = Pattern.compile("^[a-z0-9\\-]{1,64}$");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String tenantId = request.getHeader(TenantContext.HEADER);
    if (tenantId == null || tenantId.isBlank()) {
      tenantId = TenantContext.DEFAULT_TENANT;
    }
    if (!IDENTIFIER_PATTERN.matcher(tenantId).matches()) {
      reject(request, response, "租户标识格式不正确");
      return;
    }

    String orgId = trimToNull(request.getHeader(PermissionContext.HEADER_ORG));
    if (orgId != null && !IDENTIFIER_PATTERN.matcher(orgId).matches()) {
      reject(request, response, "组织标识格式不正确");
      return;
    }
    String projectId = trimToNull(request.getHeader(PermissionContext.HEADER_PROJECT));
    if (projectId != null && !IDENTIFIER_PATTERN.matcher(projectId).matches()) {
      reject(request, response, "项目标识格式不正确");
      return;
    }

    String clearanceHeader = request.getHeader(PermissionContext.HEADER_CLEARANCE);
    DataClassification clearance;
    if (clearanceHeader == null || clearanceHeader.isBlank()) {
      // 缺省许可密级 INTERNAL（不无脑放宽到最低等级）
      clearance = PermissionContext.DEFAULT_CLEARANCE;
    } else {
      try {
        clearance = DataClassification.fromString(clearanceHeader);
      } catch (IllegalArgumentException invalid) {
        reject(request, response, invalid.getMessage());
        return;
      }
    }

    TenantContext.set(tenantId);
    PermissionContext.set(orgId, projectId, clearance);
    MDC.put(MDC_KEY, tenantId);
    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
      TenantContext.clear();
      PermissionContext.clear();
    }
  }

  private void reject(HttpServletRequest request, HttpServletResponse response, String message)
      throws IOException {
    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
    response.setContentType("application/json;charset=UTF-8");
    response
        .getWriter()
        .write(
            "{\"status\":400,\"code\":\"VALIDATION_FAILED\",\"message\":\""
                + message
                + "\",\"path\":\""
                + request.getRequestURI()
                + "\"}");
  }

  private String trimToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
