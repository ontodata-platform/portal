package com.runisys.ontodata.portal.approvalcenter.api;

import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** 审批单对外视图。 */
public class ApprovalRequestResponse {

  private final String code;
  private final String approvalType;
  private final String sourceSystem;
  private final String sourceCode;
  private final String title;
  private final Map<String, Object> detail;
  private final String requester;
  private final String status;
  private final String decisionBy;
  private final String decisionNote;
  private final Instant decisionAt;
  private final Instant slaDeadline;
  private final String slaStatus;
  private final Instant createdAt;
  private final Instant updatedAt;

  private ApprovalRequestResponse(
      String code,
      String approvalType,
      String sourceSystem,
      String sourceCode,
      String title,
      Map<String, Object> detail,
      String requester,
      String status,
      String decisionBy,
      String decisionNote,
      Instant decisionAt,
      Instant slaDeadline,
      String slaStatus,
      Instant createdAt,
      Instant updatedAt) {
    this.code = code;
    this.approvalType = approvalType;
    this.sourceSystem = sourceSystem;
    this.sourceCode = sourceCode;
    this.title = title;
    this.detail = detail;
    this.requester = requester;
    this.status = status;
    this.decisionBy = decisionBy;
    this.decisionNote = decisionNote;
    this.decisionAt = decisionAt;
    this.slaDeadline = slaDeadline;
    this.slaStatus = slaStatus;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static ApprovalRequestResponse from(ApprovalRequest approval) {
    return new ApprovalRequestResponse(
        approval.getCode(),
        approval.getApprovalType(),
        approval.getSourceSystem(),
        approval.getSourceCode(),
        approval.getTitle(),
        parseDetail(approval.getDetailJson()),
        approval.getRequester(),
        approval.getStatus(),
        approval.getDecisionBy(),
        approval.getDecisionNote(),
        approval.getDecisionAt(),
        approval.getSlaDeadline(),
        approval.slaStatus(Instant.now()),
        approval.getCreatedAt(),
        approval.getUpdatedAt());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> parseDetail(String json) {
    if (json == null || json.trim().isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      Object parsed =
          new com.fasterxml.jackson.databind.ObjectMapper()
              .readValue(
                  json,
                  new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
      return parsed instanceof Map
          ? (Map<String, Object>) parsed
          : new LinkedHashMap<String, Object>();
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new IllegalStateException("审批明细数据损坏", corrupted);
    }
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

  public Map<String, Object> getDetail() {
    return detail;
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

  public Instant getSlaDeadline() {
    return slaDeadline;
  }

  public String getSlaStatus() {
    return slaStatus;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
