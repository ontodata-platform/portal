package com.runisys.ontodata.portal.aggregationcenter.api;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 上游聚合响应：sourceSystem 为数据来源软件；available=false 时携带中文降级提示 （门户前端展示降级卡片，页面查询与人工办理始终可用）；body 为上游原始响应，
 * 门户只透传展示，不建立第二权威。
 */
public class UpstreamAggregationResponse {

  private final String sourceSystem;
  private final boolean available;
  private final String message;
  private final JsonNode body;

  private UpstreamAggregationResponse(
      String sourceSystem, boolean available, String message, JsonNode body) {
    this.sourceSystem = sourceSystem;
    this.available = available;
    this.message = message;
    this.body = body;
  }

  public static UpstreamAggregationResponse available(String sourceSystem, JsonNode body) {
    return new UpstreamAggregationResponse(sourceSystem, true, null, body);
  }

  public static UpstreamAggregationResponse unavailable(String sourceSystem, String message) {
    return new UpstreamAggregationResponse(sourceSystem, false, message, null);
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public boolean isAvailable() {
    return available;
  }

  public String getMessage() {
    return message;
  }

  public JsonNode getBody() {
    return body;
  }
}
