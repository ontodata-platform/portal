package com.runisys.ontodata.portal.taskcenter.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

/** 任务聚合副本的对外视图。 */
public class PortalTaskResponse {

  private final String taskId;
  private final String taskType;
  private final String ownerSystem;
  private final String parentTaskId;
  private final String status;
  private final String stage;
  private final int progress;
  private final List<String> resourceRefs;
  private final List<String> resultRefs;
  private final String traceId;
  private final Instant createdAt;
  private final Instant updatedAt;

  private PortalTaskResponse(
      String taskId,
      String taskType,
      String ownerSystem,
      String parentTaskId,
      String status,
      String stage,
      int progress,
      List<String> resourceRefs,
      List<String> resultRefs,
      String traceId,
      Instant createdAt,
      Instant updatedAt) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.ownerSystem = ownerSystem;
    this.parentTaskId = parentTaskId;
    this.status = status;
    this.stage = stage;
    this.progress = progress;
    this.resourceRefs = resourceRefs;
    this.resultRefs = resultRefs;
    this.traceId = traceId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static PortalTaskResponse from(PortalTask task) {
    com.fasterxml.jackson.databind.ObjectMapper mapper =
        new com.fasterxml.jackson.databind.ObjectMapper();
    return new PortalTaskResponse(
        task.getTaskId(),
        task.getTaskType(),
        task.getOwnerSystem(),
        task.getParentTaskId(),
        task.getStatus(),
        task.getStage(),
        task.getProgress(),
        parseList(mapper, task.getResourceRefsJson()),
        parseList(mapper, task.getResultRefsJson()),
        task.getTraceId(),
        task.getCreatedAt(),
        task.getUpdatedAt());
  }

  private static List<String> parseList(
      com.fasterxml.jackson.databind.ObjectMapper mapper, String json) {
    if (json == null || json.trim().isEmpty()) {
      return Collections.emptyList();
    }
    try {
      return mapper.readValue(
          json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
    } catch (JsonProcessingException corrupted) {
      throw new IllegalStateException("任务引用数据损坏", corrupted);
    }
  }

  public String getTaskId() {
    return taskId;
  }

  public String getTaskType() {
    return taskType;
  }

  public String getOwnerSystem() {
    return ownerSystem;
  }

  public String getParentTaskId() {
    return parentTaskId;
  }

  public String getStatus() {
    return status;
  }

  public String getStage() {
    return stage;
  }

  public int getProgress() {
    return progress;
  }

  public List<String> getResourceRefs() {
    return resourceRefs;
  }

  public List<String> getResultRefs() {
    return resultRefs;
  }

  public String getTraceId() {
    return traceId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
