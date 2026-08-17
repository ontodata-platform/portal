package com.runisys.ontodata.portal.taskcenter.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 任务状态上报请求（总体设计 §12.3）——<b>过渡兼容接口</b>。
 *
 * <p>WP-03 起任务投影由事件订阅驱动（Kafka 消费统一事件信封），本回调路径仅保留至事件链路 稳定，此后随 ADR-006 弃用边界下线（源系统不再被要求主动推送）。
 *
 * <p>taskId 为源系统内部标识，门户按它做幂等 upsert；同一 taskId 的重复上报被折叠。 字段 {@code sourceSystem} 对齐契约 task/v1 与收敛文档
 * §8.1（WP-03 由 ownerSystem 更名）。
 */
public class UpsertPortalTaskRequest {

  @NotBlank(message = "任务标识不能为空")
  @Size(max = 128, message = "任务标识不能超过 128 个字符")
  private String taskId;

  @NotBlank(message = "任务类型不能为空")
  @Size(max = 64, message = "任务类型不能超过 64 个字符")
  private String taskType;

  @NotBlank(message = "来源系统不能为空")
  @Pattern(regexp = "[a-z][a-z0-9\\-]{0,31}", message = "来源系统只能是 1-32 位小写字母、数字或连字符")
  private String sourceSystem;

  @Size(max = 128, message = "父任务标识不能超过 128 个字符")
  private String parentTaskId;

  @NotBlank(message = "任务状态不能为空")
  @Pattern(regexp = "PENDING|RUNNING|SUCCESS|FAILED|CANCELED", message = "任务状态不合法")
  private String status;

  @Size(max = 64, message = "阶段不能超过 64 个字符")
  private String stage;

  @Min(value = 0, message = "进度不能小于 0")
  @Max(value = 100, message = "进度不能超过 100")
  private int progress;

  private List<String> resourceRefs;

  private List<String> resultRefs;

  @Size(max = 128, message = "链路标识不能超过 128 个字符")
  private String traceId;

  public String getTaskId() {
    return taskId;
  }

  public void setTaskId(String taskId) {
    this.taskId = taskId;
  }

  public String getTaskType() {
    return taskType;
  }

  public void setTaskType(String taskType) {
    this.taskType = taskType;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public void setSourceSystem(String sourceSystem) {
    this.sourceSystem = sourceSystem;
  }

  public String getParentTaskId() {
    return parentTaskId;
  }

  public void setParentTaskId(String parentTaskId) {
    this.parentTaskId = parentTaskId;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getStage() {
    return stage;
  }

  public void setStage(String stage) {
    this.stage = stage;
  }

  public int getProgress() {
    return progress;
  }

  public void setProgress(int progress) {
    this.progress = progress;
  }

  public List<String> getResourceRefs() {
    return resourceRefs;
  }

  public void setResourceRefs(List<String> resourceRefs) {
    this.resourceRefs = resourceRefs;
  }

  public List<String> getResultRefs() {
    return resultRefs;
  }

  public void setResultRefs(List<String> resultRefs) {
    this.resultRefs = resultRefs;
  }

  public String getTraceId() {
    return traceId;
  }

  public void setTraceId(String traceId) {
    this.traceId = traceId;
  }
}
