package com.runisys.ontodata.portal.aggregationcenter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class CatalogLookupTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void findsExactCodeAndPrefersUpstreamId() throws Exception {
    JsonNode body =
        MAPPER.readTree(
            """
            {"items":[
              {"id":"11111111-1111-1111-1111-111111111111","code":"dsv-a","name":"A"},
              {"id":"22222222-2222-2222-2222-222222222222","code":"dsv-b","name":"B"}
            ]}
            """);
    JsonNode item = CatalogLookup.findItem(body, "dsv-b");
    assertEquals("dsv-b", CatalogLookup.text(item, "code"));
    assertEquals("22222222-2222-2222-2222-222222222222", CatalogLookup.resolveId(item, "dsv-b"));
    assertNull(CatalogLookup.findItem(body, "dsv-missing"));
  }

  @Test
  void fallsBackToCodeWhenIdAbsent() throws Exception {
    JsonNode item = MAPPER.readTree("{\"code\":\"wf-local\",\"name\":\"本地模板\"}");
    assertEquals("wf-local", CatalogLookup.resolveId(item, "wf-local"));
  }
}
