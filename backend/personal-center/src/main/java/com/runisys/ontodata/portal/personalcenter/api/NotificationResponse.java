package com.runisys.ontodata.portal.personalcenter.api;

import com.runisys.ontodata.portal.personalcenter.domain.PortalNotification;
import java.time.Instant;

/** 通知对外视图。 */
public class NotificationResponse {

  private final String id;
  private final String type;
  private final String title;
  private final String body;
  private final String resourceRef;
  private final Instant readAt;
  private final Instant createdAt;

  public NotificationResponse(
      String id,
      String type,
      String title,
      String body,
      String resourceRef,
      Instant readAt,
      Instant createdAt) {
    this.id = id;
    this.type = type;
    this.title = title;
    this.body = body;
    this.resourceRef = resourceRef;
    this.readAt = readAt;
    this.createdAt = createdAt;
  }

  public static NotificationResponse from(PortalNotification notification) {
    return new NotificationResponse(
        notification.getId(),
        notification.getType(),
        notification.getTitle(),
        notification.getBody(),
        notification.getResourceRef(),
        notification.getReadAt(),
        notification.getCreatedAt());
  }

  public String getId() {
    return id;
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

  public Instant getCreatedAt() {
    return createdAt;
  }
}
