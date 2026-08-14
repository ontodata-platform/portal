package com.runisys.ontodata.portal.requirementcenter.api;

import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import java.time.Instant;
import java.util.Collections;
import java.util.Map;

/** 需求单对外视图。 */
public class RequirementRequestResponse {

  private final String code;
  private final String requirementType;
  private final String title;
  private final String description;
  private final String requester;
  private final String status;
  private final String assigneeSystem;
  private final String assigneeRef;
  private final Map<String, Object> plan;
  private final String closedNote;
  private final Instant createdAt;
  private final Instant updatedAt;

  private RequirementRequestResponse(
      String code,
      String requirementType,
      String title,
      String description,
      String requester,
      String status,
      String assigneeSystem,
      String assigneeRef,
      Map<String, Object> plan,
      String closedNote,
      Instant createdAt,
      Instant updatedAt) {
    this.code = code;
    this.requirementType = requirementType;
    this.title = title;
    this.description = description;
    this.requester = requester;
    this.status = status;
    this.assigneeSystem = assigneeSystem;
    this.assigneeRef = assigneeRef;
    this.plan = plan;
    this.closedNote = closedNote;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static RequirementRequestResponse from(RequirementRequest requirement) {
    return new RequirementRequestResponse(
        requirement.getCode(),
        requirement.getRequirementType(),
        requirement.getTitle(),
        requirement.getDescription(),
        requirement.getRequester(),
        requirement.getStatus(),
        requirement.getAssigneeSystem(),
        requirement.getAssigneeRef(),
        parsePlan(requirement.getPlanJson()),
        requirement.getClosedNote(),
        requirement.getCreatedAt(),
        requirement.getUpdatedAt());
  }

  private static Map<String, Object> parsePlan(String json) {
    if (json == null || json.trim().isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper()
          .readValue(
              json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new IllegalStateException("需求计划数据损坏", corrupted);
    }
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

  public Map<String, Object> getPlan() {
    return plan;
  }

  public String getClosedNote() {
    return closedNote;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
