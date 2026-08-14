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
 * 门户公告（总体设计 §5 门户运营）：栏目化内容，单向状态机。
 *
 * <p>DRAFT → PUBLISHED → ARCHIVED：发布时落 publishedAt；草稿不出现在公开查询 （不带状态参数的列表只返回 PUBLISHED），归档后不再变更（终态防重
 * 409）。M5 多租户：code 唯一约束为 (tenant_id, code) 复合，公告编码只在租户内唯一。
 */
@Entity
@Table(
    name = "portal_notice",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_portal_notice_code",
          columnNames = {"tenant_id", "code"})
    })
public class Notice {

  public static final String STATUS_DRAFT = "DRAFT";
  public static final String STATUS_PUBLISHED = "PUBLISHED";
  public static final String STATUS_ARCHIVED = "ARCHIVED";
  public static final String DEFAULT_TENANT = "default";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(nullable = false, updatable = false, length = 40)
  private String code;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, columnDefinition = "longtext")
  private String content;

  @Column(nullable = false, length = 64)
  private String section;

  @Column(nullable = false, length = 32)
  private String status;

  @Column(name = "published_at")
  private Instant publishedAt;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Notice() {}

  public Notice(
      String code, String title, String content, String section, String tenantId, Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.title = title;
    this.content = content;
    this.section = section;
    this.status = STATUS_DRAFT;
    this.tenantId = tenantId;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 发布：仅 DRAFT 可发布（服务层校验），发布时落 publishedAt。 */
  public void publish(Instant now) {
    this.status = STATUS_PUBLISHED;
    this.publishedAt = now;
    this.updatedAt = now;
  }

  /** 归档：仅 PUBLISHED 可归档（服务层校验），publishedAt 保留为发布时刻。 */
  public void archive(Instant now) {
    this.status = STATUS_ARCHIVED;
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

  public String getSection() {
    return section;
  }

  public String getStatus() {
    return status;
  }

  public Instant getPublishedAt() {
    return publishedAt;
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
