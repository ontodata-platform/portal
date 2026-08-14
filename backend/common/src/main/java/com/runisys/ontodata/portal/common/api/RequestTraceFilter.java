package com.runisys.ontodata.portal.common.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 请求级追踪标识过滤器：为每次请求确定一个稳定 traceId，贯通日志（MDC）、响应头与错误响应。
 *
 * <p>调用方可以携带 {@code X-Trace-Id} 头用于跨系统关联（只接受受限字符集的 8-128 位值，防止日志注入）； 未携带时服务端生成 UUID。过滤器最后清理
 * MDC，避免线程复用导致追踪标识串请求。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTraceFilter extends OncePerRequestFilter {

  public static final String TRACE_HEADER = "X-Trace-Id";
  public static final String MDC_KEY = "traceId";
  private static final Pattern SAFE_TRACE_ID = Pattern.compile("^[A-Za-z0-9._-]{8,128}$");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String traceId = sanitize(request.getHeader(TRACE_HEADER));
    if (traceId == null) {
      traceId = UUID.randomUUID().toString();
    }
    MDC.put(MDC_KEY, traceId);
    response.setHeader(TRACE_HEADER, traceId);
    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
    }
  }

  /** 只接受安全字符集的追踪标识；非法值一律忽略并重新生成，杜绝日志伪造与注入。 */
  private String sanitize(String candidate) {
    if (candidate == null) {
      return null;
    }
    String trimmed = candidate.trim();
    return SAFE_TRACE_ID.matcher(trimmed).matches() ? trimmed : null;
  }
}
