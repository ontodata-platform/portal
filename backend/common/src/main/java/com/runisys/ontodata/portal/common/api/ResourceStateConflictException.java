package com.runisys.ontodata.portal.common.api;

/**
 * 领域状态冲突的基础异常：统一映射 HTTP 409（STATE_CONFLICT）。
 *
 * <p>用于非法状态流转（如对运行中的任务再次启动）与并发版本冲突等业务冲突， 与唯一约束兜底（RESOURCE_CONFLICT）同属 409 但语义独立。
 */
public class ResourceStateConflictException extends RuntimeException {

  public ResourceStateConflictException(String message) {
    super(message);
  }
}
