package com.runisys.ontodata.portal.personalcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 门户通知（F3a-2）：审批结果与执行完成的事件驱动收件箱。 不替代审批/任务权威，只保存用户可见摘要。
 */
@Entity
@Table(name = "portal_notification")
public class PortalNotification {

  public static final String TYPE_APPROVAL_DECIDED = "APPROVAL_DECIDED";
  public static final String TYPE_TASK_COMPLETED = "TASK_COMPLETED";
  public static final String RECIPIENT_TENANT = "*";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(nullable = false, length = 64)
  private String recipient;

  @Column(nullable = false, length = 32)
  private String type;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(length = 500)
  private String body;

  @Column(name = "resource_ref", nullable = false, length = 128)
  private String resourceRef;

  @Column(name = "read_at")
  private Instant readAt;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected PortalNotification() {}

  public PortalNotification(
      String recipient,
      String type,
      String title,
      String body,
      String resourceRef,
      String tenantId,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.recipient = recipient;
    this.type = type;
    this.title = title;
    this.body = body;
    this.resourceRef = resourceRef;
    this.tenantId = tenantId;
    this.createdAt = now;
  }

  public void markRead(Instant now) {
    if (this.readAt == null) {
      this.readAt = now;
    }
  }

  public String getId() {
    return id;
  }

  public String getRecipient() {
    return recipient;
  }

  public String getType() {
    return type;
  }

  public String getTitle() {
    return title;
  }

  public String getBody() {
    return body;
  }

  public String getResourceRef() {
    return resourceRef;
  }

  public Instant getReadAt() {
    return readAt;
  }

  public String getTenantId() {
    return tenantId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
