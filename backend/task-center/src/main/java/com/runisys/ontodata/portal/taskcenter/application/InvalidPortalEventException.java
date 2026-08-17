package com.runisys.ontodata.portal.taskcenter.application;

/** 事件信封不满足契约最低要求（缺必填字段/非法 JSON）：投递侧不可恢复，经重试后进入死信。 */
public class InvalidPortalEventException extends RuntimeException {

  public InvalidPortalEventException(String message) {
    super(message);
  }

  public InvalidPortalEventException(String message, Throwable cause) {
    super(message, cause);
  }
}
