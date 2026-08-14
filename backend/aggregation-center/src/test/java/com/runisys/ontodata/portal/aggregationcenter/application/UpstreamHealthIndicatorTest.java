package com.runisys.ontodata.portal.aggregationcenter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.aggregationcenter.infrastructure.UpstreamHttpClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.health.Health;

/** 上游依赖健康指标单测（M5 SLA）：门户整体恒 UP，details 反映各上游 UP/DOWN。 */
class UpstreamHealthIndicatorTest {

  private UpstreamHttpClient client;
  private UpstreamHealthIndicator indicator;

  @BeforeEach
  void setUp() {
    client = mock(UpstreamHttpClient.class);
    indicator = new UpstreamHealthIndicator(client, "http://dp", "http://tf", "http://rc");
  }

  @Test
  void overallUpWithAllUpstreamsUp() {
    when(client.get(eq("http://dp"), anyString(), anyString()))
        .thenReturn(new ObjectMapper().createObjectNode());
    when(client.get(eq("http://tf"), anyString(), anyString()))
        .thenReturn(new ObjectMapper().createObjectNode());
    when(client.get(eq("http://rc"), anyString(), anyString()))
        .thenReturn(new ObjectMapper().createObjectNode());

    Health health = indicator.health();

    assertEquals("UP", health.getStatus().getCode());
    assertEquals("UP", health.getDetails().get("data-platform"));
    assertEquals("UP", health.getDetails().get("algorithm-transform"));
    assertEquals("UP", health.getDetails().get("algorithm-recombine"));
  }

  @Test
  void upstreamDownReportedInDetailsButPortalStaysUp() {
    when(client.get(eq("http://dp"), anyString(), anyString()))
        .thenReturn(new ObjectMapper().createObjectNode());
    when(client.get(eq("http://tf"), anyString(), anyString()))
        .thenThrow(new IllegalArgumentException("无法连接算法转换工具，请稍后重试"));
    when(client.get(eq("http://rc"), anyString(), anyString()))
        .thenReturn(new ObjectMapper().createObjectNode());

    Health health = indicator.health();

    assertEquals("UP", health.getStatus().getCode(), "门户降级基线：上游不可用不拖垮门户自身可用性");
    assertEquals("UP", health.getDetails().get("data-platform"));
    String transformDetail = (String) health.getDetails().get("algorithm-transform");
    assertEquals(true, transformDetail.startsWith("DOWN（"), "DOWN 详情必须携带中文原因");
    assertEquals("UP", health.getDetails().get("algorithm-recombine"));
  }
}
