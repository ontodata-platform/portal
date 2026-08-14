package com.runisys.ontodata.portal.common.api;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 平台统一错误响应。
 *
 * <p>该对象只承载可安全展示给用户的信息。异常堆栈、请求正文、凭据等敏感上下文只允许写入受控服务端日志，不能通过本对象返回。traceId 用于让页面提示与服务端日志建立关联。
 */
public class ApiErrorResponse {

  private final Instant timestamp;
  private final int status;
  private final String code;
  private final String message;
  private final String path;
  private final String traceId;
  private final Map<String, String> fieldErrors;

  public ApiErrorResponse(
      int status,
      String code,
      String message,
      String path,
      String traceId,
      Map<String, String> fieldErrors) {
    this.timestamp = Instant.now();
    this.status = status;
    this.code = code;
    this.message = message;
    this.path = path;
    this.traceId = traceId;
    this.fieldErrors =
        fieldErrors == null
            ? Collections.<String, String>emptyMap()
            : Collections.unmodifiableMap(new LinkedHashMap<String, String>(fieldErrors));
  }

  public Instant getTimestamp() {
    return timestamp;
  }

  public int getStatus() {
    return status;
  }

  public String getCode() {
    return code;
  }

  public String getMessage() {
    return message;
  }

  public String getPath() {
    return path;
  }

  public String getTraceId() {
    return traceId;
  }

  public Map<String, String> getFieldErrors() {
    return fieldErrors;
  }
}
