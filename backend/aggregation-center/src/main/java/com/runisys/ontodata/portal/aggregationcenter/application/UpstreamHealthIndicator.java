package com.runisys.ontodata.portal.aggregationcenter.application;

import com.runisys.ontodata.portal.aggregationcenter.infrastructure.UpstreamHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * 上游依赖健康指标（M5 SLA 度量）：门户 /actuator/health 携带三大上游软件的健康详情。
 *
 * <p>语义：门户自身可用性不受上游影响（降级基线：页面查询与人工办理始终可用），因此 整体状态恒为 UP；每个上游的 UP/DOWN 以 details
 * 暴露（data-platform/algorithm-transform/ algorithm-recombine），SLO 度量与告警按 details 聚合判断。
 */
@Component
public class UpstreamHealthIndicator implements HealthIndicator {

  private final UpstreamHttpClient upstreamHttpClient;
  private final String dataPlatformBaseUrl;
  private final String transformBaseUrl;
  private final String recombineBaseUrl;

  public UpstreamHealthIndicator(
      UpstreamHttpClient upstreamHttpClient,
      @Value("${ontodata.upstream.data-platform.base-url:http://127.0.0.1:18081}")
          String dataPlatformBaseUrl,
      @Value("${ontodata.upstream.transform.base-url:http://127.0.0.1:18082}")
          String transformBaseUrl,
      @Value("${ontodata.upstream.recombine.base-url:http://127.0.0.1:18083}")
          String recombineBaseUrl) {
    this.upstreamHttpClient = upstreamHttpClient;
    this.dataPlatformBaseUrl = dataPlatformBaseUrl;
    this.transformBaseUrl = transformBaseUrl;
    this.recombineBaseUrl = recombineBaseUrl;
  }

  @Override
  public Health health() {
    return Health.up()
        .withDetail("data-platform", probe(dataPlatformBaseUrl, "管理平台"))
        .withDetail("algorithm-transform", probe(transformBaseUrl, "算法转换工具"))
        .withDetail("algorithm-recombine", probe(recombineBaseUrl, "算法重组平台"))
        .build();
  }

  /** 探活：上游 actuator/health 200 为 UP；失败为 DOWN + 中文原因。 */
  private Object probe(String baseUrl, String label) {
    try {
      upstreamHttpClient.get(baseUrl, "/actuator/health", label);
      return "UP";
    } catch (IllegalArgumentException failure) {
      return "DOWN（" + failure.getMessage() + "）";
    }
  }
}
