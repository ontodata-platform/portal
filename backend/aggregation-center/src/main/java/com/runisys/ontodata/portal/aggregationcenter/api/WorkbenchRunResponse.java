package com.runisys.ontodata.portal.aggregationcenter.api;

/** 工作台运行门面响应：taskId 来自重组平台。 */
public class WorkbenchRunResponse {

  private final String taskId;
  private final String status;
  private final boolean started;

  public WorkbenchRunResponse(String taskId, String status, boolean started) {
    this.taskId = taskId;
    this.status = status;
    this.started = started;
  }

  public String getTaskId() {
    return taskId;
  }

  public String getStatus() {
    return status;
  }

  public boolean isStarted() {
    return started;
  }
}
