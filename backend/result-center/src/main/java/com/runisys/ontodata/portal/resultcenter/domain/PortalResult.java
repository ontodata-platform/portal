package com.runisys.ontodata.portal.resultcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

/**
 * 结果引用登记（总体设计 §13.4）：可追踪率 100%。
 *
 * <p>结果权威归产生它的软件：门户只存资源引用与元数据，大对象走对象存储； (sourceSystem, resultId) 唯一标识一个结果，重复登记按幂等更新折叠； sourceTaskId
 * 关联统一任务中心，实现“任务 → 结果”双向追踪。
 */
@Entity
@Table(
    name = "portal_result",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_portal_result_identity",
          columnNames = {"tenant_id", "source_system", "result_id"})
    })
public class PortalResult {

  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(name = "result_id", nullable = false, updatable = false, length = 128)
  private String resultId;

  @Column(name = "source_system", nullable = false, updatable = false, length = 32)
  private String sourceSystem;

  @Column(name = "result_type", nullable = false, length = 40)
  private String resultType;

  @Column(name = "resource_refs_json", columnDefinition = "longtext")
  private String resourceRefsJson;

  @Column(name = "metadata_json", columnDefinition = "longtext")
  private String metadataJson;

  @Column(name = "source_task_id", length = 128)
  private String sourceTaskId;

  @Column(name = "trace_id", length = 128)
  private String traceId;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected PortalResult() {}

  public PortalResult(
      String resultId,
      String sourceSystem,
      String resultType,
      String resourceRefsJson,
      String metadataJson,
      String sourceTaskId,
      String traceId,
      String tenantId,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.resultId = resultId;
    this.sourceSystem = sourceSystem;
    this.resultType = resultType;
    this.resourceRefsJson = resourceRefsJson;
    this.metadataJson = metadataJson;
    this.sourceTaskId = sourceTaskId;
    this.traceId = traceId;
    this.tenantId = tenantId;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 幂等更新：引用与元数据以源软件最新上报为准。 */
  public void update(
      String resultType,
      String resourceRefsJson,
      String metadataJson,
      String sourceTaskId,
      String traceId,
      Instant now) {
    this.resultType = resultType;
    this.resourceRefsJson = resourceRefsJson;
    this.metadataJson = metadataJson;
    this.sourceTaskId = sourceTaskId;
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

  public String getResultId() {
    return resultId;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public String getResultType() {
    return resultType;
  }

  public String getResourceRefsJson() {
    return resourceRefsJson;
  }

  public String getMetadataJson() {
    return metadataJson;
  }

  public String getSourceTaskId() {
    return sourceTaskId;
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
