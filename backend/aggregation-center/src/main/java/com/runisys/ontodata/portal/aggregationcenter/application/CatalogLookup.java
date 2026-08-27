package com.runisys.ontodata.portal.aggregationcenter.application;

import com.fasterxml.jackson.databind.JsonNode;

/** 从上游分页目录里按稳定编码精确匹配条目。 */
public final class CatalogLookup {

  private CatalogLookup() {}

  public static JsonNode findItem(JsonNode body, String code) {
    if (body == null || code == null || !body.has("items") || !body.get("items").isArray()) {
      return null;
    }
    for (JsonNode item : body.get("items")) {
      if (code.equals(text(item, "code")) || code.equals(text(item, "id"))) {
        return item;
      }
    }
    return null;
  }

  /** 订阅/运行优先用上游 id；目录只有 code 时退回 code。 */
  public static String resolveId(JsonNode item, String code) {
    String id = text(item, "id");
    return id != null ? id : code;
  }

  public static String text(JsonNode node, String field) {
    if (node == null || !node.has(field) || node.get(field).isNull()) {
      return null;
    }
    String value = node.get(field).asText();
    return value == null || value.isBlank() ? null : value;
  }
}
