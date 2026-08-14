package com.runisys.ontodata.portal.requirementcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 需求单（总体设计 §5 需求管理）：门户本地权威业务对象。
 *
 * <p>状态机（单向推进，终态防重）： OPEN → ANALYZING → ASSIGNED → IN_PROGRESS → COMPLETED；OPEN/ANALYZING 可
 * CANCELED。 分派只登记目标软件与引用编码，不替目标软件执行；normalizedTitle 用于去重（同类型同 归一化标题存在非终态单时拒绝新登记）。
 */
@Entity
@Table(name = "portal_requirement")
public class RequirementRequest {

  public static final String STATUS_OPEN = "OPEN";
  public static final String STATUS_ANALYZING = "ANALYZING";
  public static final String STATUS_ASSIGNED = "ASSIGNED";
  public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
  public static final String STATUS_COMPLETED = "COMPLETED";
  public static final String STATUS_CANCELED = "CANCELED";
  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  /** 稳定编码 req-*：跨软件引用（分派后目标软件回链），生成后永不变更。 */
  @Column(nullable = false, updatable = false, length = 40, unique = true)
  private String code;

  @Column(name = "requirement_type", nullable = false, updatable = false, length = 40)
  private String requirementType;

  @Column(nullable = false, updatable = false, length = 200)
  private String title;

  @Column(name = "normalized_title", nullable = false, updatable = false, length = 200)
  private String normalizedTitle;

  @Column(columnDefinition = "longtext")
  private String description;

  @Column(nullable = false, updatable = false, length = 64)
  private String requester;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(name = "assignee_system", length = 32)
  private String assigneeSystem;

  @Column(name = "assignee_ref", length = 128)
  private String assigneeRef;

  @Column(name = "plan_json", columnDefinition = "longtext")
  private String planJson;

  @Column(name = "closed_note", length = 500)
  private String closedNote;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected RequirementRequest() {}

  public RequirementRequest(
      String code,
      String requirementType,
      String title,
      String normalizedTitle,
      String description,
      String requester,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.requirementType = requirementType;
    this.title = title;
    this.normalizedTitle = normalizedTitle;
    this.description = description;
    this.requester = requester;
    this.status = STATUS_OPEN;
    this.tenantId = DEFAULT_TENANT;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 状态流转：允许的目标状态由服务层白名单校验（终态防重），此处只应用。 */
  public void transition(
      String target,
      String assigneeSystem,
      String assigneeRef,
      String planJson,
      String closedNote,
      Instant now) {
    this.status = target;
    if (assigneeSystem != null) {
      this.assigneeSystem = assigneeSystem;
      this.assigneeRef = assigneeRef;
    }
    if (planJson != null) {
      this.planJson = planJson;
    }
    if (closedNote != null) {
      this.closedNote = closedNote;
    }
    this.updatedAt = now;
  }

  /** 更新计划：ASSIGNED 前均允许调整计划。 */
  public void updatePlan(String planJson, Instant now) {
    this.planJson = planJson;
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

  public String getCode() {
    return code;
  }

  public String getRequirementType() {
    return requirementType;
  }

  public String getTitle() {
    return title;
  }

  public String getNormalizedTitle() {
    return normalizedTitle;
  }

  public String getDescription() {
    return description;
  }

  public String getRequester() {
    return requester;
  }

  public String getStatus() {
    return status;
  }

  public String getAssigneeSystem() {
    return assigneeSystem;
  }

  public String getAssigneeRef() {
    return assigneeRef;
  }

  public String getPlanJson() {
    return planJson;
  }

  public String getClosedNote() {
    return closedNote;
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
