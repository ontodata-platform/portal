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
 * 任务投影（总体设计 §12.3、收敛文档 §8.1）：各源系统任务状态在门户的<b>事件驱动投影</b>。
 *
 * <p><b>投影语义（WP-03 起生效）：</b>本表不是权威数据——权威状态在产生任务的源系统（数据中台 / 算法转换 /
 * 算法重组等），门户只保存由统一事件信封（contracts/integration/v1）投影而来的只读副本； 投影可被清空并从事件流整体重放重建（POST
 * /api/v1/projections/rebuild），因此任何字段都不得被 门户当作业务事实来源使用。
 *
 * <p>不变量：按源系统 taskId 幂等 upsert（幂等键 (tenant_id, task_id)）；进度只增不回退； 乱序防护由 eventVersion 承担（仅应用
 * aggregateVersion 更大的事件）；traceId 贯通源软件日志对账； lastEventId 记录最近一次已应用事件，供对账与重放核对。
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

  /** 源系统（事件信封 producer；WP-03 由 owner_system 更名，对齐契约 task/v1 与收敛文档 §8.1）。 */
  @Column(name = "source_system", nullable = false, length = 32)
  private String sourceSystem;

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

  /** 最近一次已应用事件的聚合版本（信封 aggregateVersion）；乱序事件的丢弃基准。 */
  @Column(name = "event_version", nullable = false)
  private long eventVersion;

  /** 最近一次已应用事件的事件标识（信封 eventId）；供对账与重放核对。 */
  @Column(name = "last_event_id", length = 128)
  private String lastEventId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected PortalTask() {}

  public PortalTask(
      String taskId,
      String taskType,
      String sourceSystem,
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
    this.sourceSystem = sourceSystem;
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

  /** 幂等更新（回调式 upsert 过渡路径）：进度只增不回退；状态/阶段/引用以最新上报为准。 */
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

  /**
   * 应用事件投影（事件驱动主路径）：在 {@link #update} 不变量之上追加事件溯源字段。
   *
   * <p>乱序防护：仅当事件聚合版本更大时才抬升 {@code eventVersion}；调用方（TaskProjectionEventHandler） 已按"aggregateVersion
   * <= 当前 eventVersion 丢弃"裁决，这里再兜一层上限保护。 {@code eventVersion} 为空表示事件未携带可解析的聚合版本——按契约仍可投影，但不参与乱序防护。
   */
  public void applyEvent(
      String status,
      String stage,
      int progress,
      String resourceRefsJson,
      String resultRefsJson,
      String traceId,
      Long eventVersion,
      String lastEventId,
      Instant now) {
    update(status, stage, progress, resourceRefsJson, resultRefsJson, traceId, now);
    if (eventVersion != null && eventVersion > this.eventVersion) {
      this.eventVersion = eventVersion;
    }
    this.lastEventId = lastEventId;
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

  public String getSourceSystem() {
    return sourceSystem;
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

  public long getEventVersion() {
    return eventVersion;
  }

  public String getLastEventId() {
    return lastEventId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
