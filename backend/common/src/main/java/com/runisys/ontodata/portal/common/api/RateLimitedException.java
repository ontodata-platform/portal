package com.runisys.ontodata.portal.common.api;

/** 限流拒绝的基础异常：统一映射 HTTP 429（RATE_LIMITED）。 */
public class RateLimitedException extends RuntimeException {

  public RateLimitedException(String message) {
    super(message);
  }
}
