package com.runisys.ontodata.portal.common.api;

/**
 * 领域资源不存在的基础异常：统一映射 HTTP 404（NOT_FOUND）。
 *
 * <p>各模块的业务异常继承本类，即可在 GlobalExceptionHandler 获得稳定语义， 避免每个模块重复注册异常处理器。
 */
public class ResourceNotFoundException extends RuntimeException {

  public ResourceNotFoundException(String message) {
    super(message);
  }
}
