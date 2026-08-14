package com.runisys.ontodata.portal.operationscenter.domain;

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
 * 门户反馈（总体设计 §5 门户运营）：PENDING → HANDLED，终态防重。
 *
 * <p>处理说明必填（可追踪的办理证据）；重复处理 409。M5 多租户：code 唯一约束为 (tenant_id, code) 复合，反馈编码只在租户内唯一。
 */
@Entity
@Table(
    name = "portal_feedback",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_portal_feedback_code",
          columnNames = {"tenant_id", "code"})
    })
public class Feedback {

  public static final String STATUS_PENDING = "PENDING";
  public static final String STATUS_HANDLED = "HANDLED";
  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(nullable = false, updatable = false, length = 40)
  private String code;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, length = 2000)
  private String content;

  @Column(length = 200)
  private String contact;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(name = "handle_note", length = 500)
  private String handleNote;

  @Column(name = "handled_at")
  private Instant handledAt;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Feedback() {}

  public Feedback(
      String code, String title, String content, String contact, String tenantId, Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.title = title;
    this.content = content;
    this.contact = contact;
    this.status = STATUS_PENDING;
    this.tenantId = tenantId;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 处理：仅 PENDING 可处理（服务层校验），处理说明必填。 */
  public void handle(String handleNote, Instant now) {
    this.status = STATUS_HANDLED;
    this.handleNote = handleNote;
    this.handledAt = now;
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

  public String getTitle() {
    return title;
  }

  public String getContent() {
    return content;
  }

  public String getContact() {
    return contact;
  }

  public String getStatus() {
    return status;
  }

  public String getHandleNote() {
    return handleNote;
  }

  public Instant getHandledAt() {
    return handledAt;
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
