package com.runisys.ontodata.portal.operationscenter.api;

import com.runisys.ontodata.portal.operationscenter.domain.Feedback;
import java.time.Instant;

/** 反馈对外视图。 */
public class FeedbackResponse {

  private final String code;
  private final String title;
  private final String content;
  private final String contact;
  private final String status;
  private final String handleNote;
  private final Instant handledAt;
  private final Instant createdAt;
  private final Instant updatedAt;

  private FeedbackResponse(
      String code,
      String title,
      String content,
      String contact,
      String status,
      String handleNote,
      Instant handledAt,
      Instant createdAt,
      Instant updatedAt) {
    this.code = code;
    this.title = title;
    this.content = content;
    this.contact = contact;
    this.status = status;
    this.handleNote = handleNote;
    this.handledAt = handledAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static FeedbackResponse from(Feedback feedback) {
    return new FeedbackResponse(
        feedback.getCode(),
        feedback.getTitle(),
        feedback.getContent(),
        feedback.getContact(),
        feedback.getStatus(),
        feedback.getHandleNote(),
        feedback.getHandledAt(),
        feedback.getCreatedAt(),
        feedback.getUpdatedAt());
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

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
