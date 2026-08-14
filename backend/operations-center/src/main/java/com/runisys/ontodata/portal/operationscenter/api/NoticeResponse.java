package com.runisys.ontodata.portal.operationscenter.api;

import com.runisys.ontodata.portal.operationscenter.domain.Notice;
import java.time.Instant;

/** 公告对外视图。 */
public class NoticeResponse {

  private final String code;
  private final String title;
  private final String content;
  private final String section;
  private final String status;
  private final Instant publishedAt;
  private final Instant createdAt;
  private final Instant updatedAt;

  private NoticeResponse(
      String code,
      String title,
      String content,
      String section,
      String status,
      Instant publishedAt,
      Instant createdAt,
      Instant updatedAt) {
    this.code = code;
    this.title = title;
    this.content = content;
    this.section = section;
    this.status = status;
    this.publishedAt = publishedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static NoticeResponse from(Notice notice) {
    return new NoticeResponse(
        notice.getCode(),
        notice.getTitle(),
        notice.getContent(),
        notice.getSection(),
        notice.getStatus(),
        notice.getPublishedAt(),
        notice.getCreatedAt(),
        notice.getUpdatedAt());
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

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
