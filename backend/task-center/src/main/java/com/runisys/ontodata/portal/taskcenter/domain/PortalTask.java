package com.runisys.ontodata.portal.taskcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 任务聚合副本（总体设计 §12.3）：按源软件 taskId 幂等 upsert。
 *
 * <p>不变量：副本可由源系统重建（不作权威）；进度只增不回退；父任务只聚合子任务 状态；traceId 贯通源软件日志对账。
 */
@Entity
@Table(name = "portal_task")
public class PortalTask {

  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(name = "task_id", nullable = false, updatable = false, length = 128, unique = true)
  private String taskId;

  @Column(name = "task_type", nullable = false, length = 64)
  private String taskType;

  @Column(name = "owner_system", nullable = false, length = 32)
  private String ownerSystem;

  @Column(name = "parent_task_id", length = 128)
  private String parentTaskId;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(length = 64)
  private String stage;

  @Column(nullable = false)
  private int progress;

  @Column(name = "resource_refs_json", columnDefinition = "longtext")
  private String resourceRefsJson;

  @Column(name = "result_refs_json", columnDefinition = "longtext")
  private String resultRefsJson;

  @Column(name = "trace_id", length = 128)
  private String traceId;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected PortalTask() {}

  public PortalTask(
      String taskId,
      String taskType,
      String ownerSystem,
      String parentTaskId,
      String status,
      String stage,
      int progress,
      String resourceRefsJson,
      String resultRefsJson,
      String traceId,
      String tenantId,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.taskId = taskId;
    this.taskType = taskType;
    this.ownerSystem = ownerSystem;
    this.parentTaskId = parentTaskId;
    this.status = status;
    this.stage = stage;
    this.progress = progress;
    this.resourceRefsJson = resourceRefsJson;
    this.resultRefsJson = resultRefsJson;
    this.traceId = traceId;
    this.tenantId = tenantId;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 幂等更新：进度只增不回退；状态/阶段/引用以最新事件为准。 */
  public void update(
      String status,
      String stage,
      int progress,
      String resourceRefsJson,
      String resultRefsJson,
      String traceId,
      Instant now) {
    this.status = status;
    this.stage = stage;
    this.progress = Math.max(this.progress, progress);
    this.resourceRefsJson = resourceRefsJson;
    this.resultRefsJson = resultRefsJson;
    this.traceId = traceId;
    this.updatedAt = now;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) createdAt = Instant.now();
    if (updatedAt == null) updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public String getId() {
    return id;
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

  public String getResourceRefsJson() {
    return resourceRefsJson;
  }

  public String getResultRefsJson() {
    return resultRefsJson;
  }

  public String getTraceId() {
    return traceId;
  }

  public String getTenantId() {
    return tenantId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
