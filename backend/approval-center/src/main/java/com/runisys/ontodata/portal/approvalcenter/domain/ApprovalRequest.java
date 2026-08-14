package com.runisys.ontodata.portal.approvalcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 审批单（总体设计 §5 门户、§12.3 权威表）：审批流骨架。
 *
 * <p>状态机：PENDING → APPROVED/REJECTED；终态不可再审批（重复审批 409）。 审批不替代业务软件确认链路：MCP 网关 R4
 * 工具把确认卡（cfm-*）升级为审批单时， sourceSystem=mcp-gateway、sourceCode=cfm-*，网关按 code 回查审批结果。
 */
@Entity
@Table(name = "portal_approval_request")
public class ApprovalRequest {

  public static final String STATUS_PENDING = "PENDING";
  public static final String STATUS_APPROVED = "APPROVED";
  public static final String STATUS_REJECTED = "REJECTED";
  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  /** 稳定编码 apr-*：跨软件回查的契约引用，生成后永不变更。 */
  @Column(nullable = false, updatable = false, length = 40, unique = true)
  private String code;

  @Column(name = "approval_type", nullable = false, updatable = false, length = 40)
  private String approvalType;

  @Column(name = "source_system", nullable = false, updatable = false, length = 32)
  private String sourceSystem;

  @Column(name = "source_code", updatable = false, length = 128)
  private String sourceCode;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(name = "detail_json", columnDefinition = "longtext")
  private String detailJson;

  @Column(nullable = false, updatable = false, length = 64)
  private String requester;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(name = "decision_by", length = 64)
  private String decisionBy;

  @Column(name = "decision_note", length = 500)
  private String decisionNote;

  @Column(name = "decision_at")
  private Instant decisionAt;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected ApprovalRequest() {}

  public ApprovalRequest(
      String code,
      String approvalType,
      String sourceSystem,
      String sourceCode,
      String title,
      String detailJson,
      String requester,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.approvalType = approvalType;
    this.sourceSystem = sourceSystem;
    this.sourceCode = sourceCode;
    this.title = title;
    this.detailJson = detailJson;
    this.requester = requester;
    this.status = STATUS_PENDING;
    this.tenantId = DEFAULT_TENANT;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 审批：仅 PENDING 可决策；终态防重由服务层在调用前校验。 */
  public void decide(String decision, String decisionBy, String decisionNote, Instant now) {
    this.status = decision;
    this.decisionBy = decisionBy;
    this.decisionNote = decisionNote;
    this.decisionAt = now;
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

  public String getApprovalType() {
    return approvalType;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public String getSourceCode() {
    return sourceCode;
  }

  public String getTitle() {
    return title;
  }

  public String getDetailJson() {
    return detailJson;
  }

  public String getRequester() {
    return requester;
  }

  public String getStatus() {
    return status;
  }

  public String getDecisionBy() {
    return decisionBy;
  }

  public String getDecisionNote() {
    return decisionNote;
  }

  public Instant getDecisionAt() {
    return decisionAt;
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
