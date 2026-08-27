package com.runisys.ontodata.portal.scenariocenter.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.scenariocenter.domain.PortalScenario;
import java.time.Instant;

/** 场景响应：装配字段（ontologyRefs/bindings/presentation）以解析后的 JSON 返回，便于前端直接渲染。 */
public class ScenarioResponse {

  private final String code;
  private final String version;
  private final String name;
  private final String description;
  private final String projectId;
  private final String status;
  private final JsonNode ontologyRefs;
  private final JsonNode bindings;
  private final JsonNode presentation;
  private final String tenantId;
  private final String createdBy;
  private final Instant createdAt;
  private final Instant updatedAt;

  private ScenarioResponse(PortalScenario scenario, ObjectMapper objectMapper) {
    this.code = scenario.getCode();
    this.version = scenario.getVersion();
    this.name = scenario.getName();
    this.description = scenario.getDescription();
    this.projectId = scenario.getProjectId();
    this.status = scenario.getStatus();
    this.ontologyRefs = parse(objectMapper, scenario.getOntologyRefsJson());
    this.bindings = parse(objectMapper, scenario.getBindingsJson());
    this.presentation = parse(objectMapper, scenario.getPresentationJson());
    this.tenantId = scenario.getTenantId();
    this.createdBy = scenario.getCreatedBy();
    this.createdAt = scenario.getCreatedAt();
    this.updatedAt = scenario.getUpdatedAt();
  }

  public static ScenarioResponse from(PortalScenario scenario, ObjectMapper objectMapper) {
    return new ScenarioResponse(scenario, objectMapper);
  }

  private static JsonNode parse(ObjectMapper objectMapper, String json) {
    if (json == null) {
      return null;
    }
    try {
      return objectMapper.readTree(json);
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new IllegalStateException("场景装配字段落库数据损坏，无法解析", corrupted);
    }
  }

  public String getCode() {
    return code;
  }

  public String getVersion() {
    return version;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getProjectId() {
    return projectId;
  }

  public String getStatus() {
    return status;
  }

  public JsonNode getOntologyRefs() {
    return ontologyRefs;
  }

  public JsonNode getBindings() {
    return bindings;
  }

  public JsonNode getPresentation() {
    return presentation;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
