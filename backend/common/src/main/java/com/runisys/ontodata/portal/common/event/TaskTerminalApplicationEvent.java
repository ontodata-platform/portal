package com.runisys.ontodata.portal.common.event;

/**
 * 任务投影到达终态（SUCCESS/FAILED/CANCELED）后的同进程事件，供通知中心订阅。
 */
public class TaskTerminalApplicationEvent {

  private final String taskId;
  private final String status;
  private final String sourceSystem;
  private final String tenantId;

  public TaskTerminalApplicationEvent(
      String taskId, String status, String sourceSystem, String tenantId) {
    this.taskId = taskId;
    this.status = status;
    this.sourceSystem = sourceSystem;
    this.tenantId = tenantId;
  }

  public String getTaskId() {
    return taskId;
  }

  public String getStatus() {
    return status;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public String getTenantId() {
    return tenantId;
  }
}
