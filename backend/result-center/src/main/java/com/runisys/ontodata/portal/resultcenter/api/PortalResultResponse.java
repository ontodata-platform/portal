package com.runisys.ontodata.portal.resultcenter.api;

import com.runisys.ontodata.portal.resultcenter.domain.PortalResult;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** 结果引用对外视图。 */
public class PortalResultResponse {

  private final String resultId;
  private final String sourceSystem;
  private final String resultType;
  private final List<String> resourceRefs;
  private final Map<String, Object> metadata;
  private final String sourceTaskId;
  private final String traceId;
  private final Instant createdAt;
  private final Instant updatedAt;

  private PortalResultResponse(
      String resultId,
      String sourceSystem,
      String resultType,
      List<String> resourceRefs,
      Map<String, Object> metadata,
      String sourceTaskId,
      String traceId,
      Instant createdAt,
      Instant updatedAt) {
    this.resultId = resultId;
    this.sourceSystem = sourceSystem;
    this.resultType = resultType;
    this.resourceRefs = resourceRefs;
    this.metadata = metadata;
    this.sourceTaskId = sourceTaskId;
    this.traceId = traceId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static PortalResultResponse from(PortalResult result) {
    com.fasterxml.jackson.databind.ObjectMapper mapper =
        new com.fasterxml.jackson.databind.ObjectMapper();
    return new PortalResultResponse(
        result.getResultId(),
        result.getSourceSystem(),
        result.getResultType(),
        parseList(mapper, result.getResourceRefsJson()),
        parseMap(mapper, result.getMetadataJson()),
        result.getSourceTaskId(),
        result.getTraceId(),
        result.getCreatedAt(),
        result.getUpdatedAt());
  }

  private static List<String> parseList(
      com.fasterxml.jackson.databind.ObjectMapper mapper, String json) {
    if (json == null || json.trim().isEmpty()) {
      return Collections.emptyList();
    }
    try {
      return mapper.readValue(
          json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new IllegalStateException("结果引用数据损坏", corrupted);
    }
  }

  private static Map<String, Object> parseMap(
      com.fasterxml.jackson.databind.ObjectMapper mapper, String json) {
    if (json == null || json.trim().isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      return mapper.readValue(
          json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new IllegalStateException("结果元数据损坏", corrupted);
    }
  }

  public String getResultId() {
    return resultId;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public String getResultType() {
    return resultType;
  }

  public List<String> getResourceRefs() {
    return resourceRefs;
  }

  public Map<String, Object> getMetadata() {
    return metadata;
  }

  public String getSourceTaskId() {
    return sourceTaskId;
  }

  public String getTraceId() {
    return traceId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
