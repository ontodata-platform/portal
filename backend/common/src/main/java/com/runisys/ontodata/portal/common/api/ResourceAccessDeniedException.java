package com.runisys.ontodata.portal.common.api;

/** 访问被拒绝的基础异常：统一映射 HTTP 403（FORBIDDEN）。 */
public class ResourceAccessDeniedException extends RuntimeException {

  public ResourceAccessDeniedException(String message) {
    super(message);
  }
}
