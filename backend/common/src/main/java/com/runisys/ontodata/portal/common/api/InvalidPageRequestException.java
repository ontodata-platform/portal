package com.runisys.ontodata.portal.common.api;

/**
 * 分页或排序参数不符合平台公开契约。
 *
 * <p>该异常只包含可安全展示的参数错误，不携带 SQL、实体字段或数据库实现细节。
 */
public class InvalidPageRequestException extends IllegalArgumentException {

  public InvalidPageRequestException(String message) {
    super(message);
  }
}
