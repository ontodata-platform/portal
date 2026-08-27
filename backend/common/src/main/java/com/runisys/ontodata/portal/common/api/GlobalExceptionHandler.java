package com.runisys.ontodata.portal.common.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 将控制器异常转换为稳定的中文错误协议。
 *
 * <p>预期业务错误映射为明确状态码；未预期异常只向前端暴露 traceId，完整堆栈仅进入服务端日志。 该处理器与 ontology-platform 同构：错误结构、traceId
 * 语义与消息风格保持一致， 各模块后续新增业务异常时在本类按同一模式注册。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
      MethodArgumentNotValidException exception, HttpServletRequest request) {
    Map<String, String> fieldErrors = new LinkedHashMap<String, String>();
    exception
        .getBindingResult()
        .getFieldErrors()
        .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
    return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "请求参数校验失败", request, fieldErrors);
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
      ConstraintViolationException exception, HttpServletRequest request) {
    return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "请求参数校验失败", request, null);
  }

  /** 必填请求参数缺失：与校验失败同为 400 VALIDATION_FAILED（否则落入兜底 500）。 */
  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<ApiErrorResponse> handleMissingParameter(
      MissingServletRequestParameterException exception, HttpServletRequest request) {
    return response(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_FAILED",
        "缺少必填请求参数：" + exception.getParameterName(),
        request,
        null);
  }

  @ExceptionHandler(BindException.class)
  public ResponseEntity<ApiErrorResponse> handleBind(
      BindException exception, HttpServletRequest request) {
    return response(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "请求参数校验失败", request, null);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiErrorResponse> handleUnreadable(
      HttpMessageNotReadableException exception, HttpServletRequest request) {
    return response(HttpStatus.BAD_REQUEST, "MALFORMED_JSON", "请求体不是合法的 JSON", request, null);
  }

  @ExceptionHandler(InvalidPageRequestException.class)
  public ResponseEntity<ApiErrorResponse> handleInvalidPage(
      InvalidPageRequestException exception, HttpServletRequest request) {
    return response(
        HttpStatus.BAD_REQUEST, "INVALID_PAGE_REQUEST", exception.getMessage(), request, null);
  }

  /** 领域资源不存在：各模块继承 ResourceNotFoundException 即获得 404 语义。 */
  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ApiErrorResponse> handleNotFound(
      ResourceNotFoundException exception, HttpServletRequest request) {
    return response(HttpStatus.NOT_FOUND, "NOT_FOUND", exception.getMessage(), request, null);
  }

  /** 领域状态冲突（非法状态流转、并发版本冲突）：映射 409。 */
  @ExceptionHandler(ResourceStateConflictException.class)
  public ResponseEntity<ApiErrorResponse> handleStateConflict(
      ResourceStateConflictException exception, HttpServletRequest request) {
    return response(HttpStatus.CONFLICT, "STATE_CONFLICT", exception.getMessage(), request, null);
  }

  /** 访问被拒绝（订阅撤销/未授权）：映射 403。 */
  @ExceptionHandler(ResourceAccessDeniedException.class)
  public ResponseEntity<ApiErrorResponse> handleAccessDenied(
      ResourceAccessDeniedException exception, HttpServletRequest request) {
    return response(HttpStatus.FORBIDDEN, "FORBIDDEN", exception.getMessage(), request, null);
  }

  /** 限流拒绝：映射 429，调用方按窗口退避重试。 */
  @ExceptionHandler(RateLimitedException.class)
  public ResponseEntity<ApiErrorResponse> handleRateLimited(
      RateLimitedException exception, HttpServletRequest request) {
    return response(
        HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", exception.getMessage(), request, null);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiErrorResponse> handleIllegalArgument(
      IllegalArgumentException exception, HttpServletRequest request) {
    return response(
        HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT", exception.getMessage(), request, null);
  }

  /** 上游写门面失败：502，调用方可重试；不得降级为 200。 */
  @ExceptionHandler(UpstreamWriteException.class)
  public ResponseEntity<ApiErrorResponse> handleUpstreamWrite(
      UpstreamWriteException exception, HttpServletRequest request) {
    return response(
        HttpStatus.BAD_GATEWAY, "UPSTREAM_FAILED", exception.getMessage(), request, null);
  }

  /** 唯一约束冲突统一映射 409：并发创建或重复编码都以稳定冲突语义返回。 */
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiErrorResponse> handleDataIntegrity(
      DataIntegrityViolationException exception, HttpServletRequest request) {
    return response(HttpStatus.CONFLICT, "RESOURCE_CONFLICT", "资源冲突，请检查唯一标识后重试", request, null);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleUnexpected(
      Exception exception, HttpServletRequest request) {
    String traceId = newTraceId();
    LOGGER.error(
        "未预期接口异常，traceId={}, method={}, path={}",
        traceId,
        request.getMethod(),
        request.getRequestURI(),
        exception);
    return response(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "INTERNAL_SERVER_ERROR",
        "服务处理失败，请稍后重试；如问题持续，请提供追踪编号 " + traceId,
        request,
        null,
        traceId);
  }

  private ResponseEntity<ApiErrorResponse> response(
      HttpStatus status,
      String code,
      String message,
      HttpServletRequest request,
      Map<String, String> fieldErrors) {
    return response(status, code, message, request, fieldErrors, newTraceId());
  }

  private ResponseEntity<ApiErrorResponse> response(
      HttpStatus status,
      String code,
      String message,
      HttpServletRequest request,
      Map<String, String> fieldErrors,
      String traceId) {
    ApiErrorResponse body =
        new ApiErrorResponse(
            status.value(), code, message, request.getRequestURI(), traceId, fieldErrors);
    return ResponseEntity.status(status).body(body);
  }

  /** 优先复用请求过滤器的追踪标识，保证错误响应与访问日志指向同一次请求。 */
  private String newTraceId() {
    String mdcTraceId = MDC.get(RequestTraceFilter.MDC_KEY);
    return mdcTraceId != null ? mdcTraceId : UUID.randomUUID().toString();
  }
}
