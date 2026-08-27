package com.runisys.ontodata.portal.aggregationcenter.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.UpstreamWriteException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * 上游软件 REST 读取客户端（聚合展示专用，只读）：数据商城/算法工作台经各软件正式 REST 契约读取目录，门户不建立第二权威。
 *
 * <p>任何失败（不可达/超时/非 2xx/解析失败）统一抛中文 IllegalArgumentException，由聚合 服务降级为
 * available=false（门户展示降级卡片，页面查询与人工办理始终可用——模型降级 基线）。
 */
@Component
public class UpstreamHttpClient {

  private static final Duration TIMEOUT = Duration.ofSeconds(5);

  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public UpstreamHttpClient(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  }

  /**
   * POST 上游写接口并解析 JSON。失败抛 {@link UpstreamWriteException}（502），不得降级为
   * 200。空响应体返回空对象。
   */
  public JsonNode post(String baseUrl, String path, Object jsonBody, String label) {
    String payload;
    try {
      payload = jsonBody == null ? "{}" : objectMapper.writeValueAsString(jsonBody);
    } catch (com.fasterxml.jackson.core.JsonProcessingException impossible) {
      throw new IllegalStateException(label + "请求序列化失败", impossible);
    }
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header(TenantContext.HEADER, TenantContext.current())
            .header("Content-Type", "application/json")
            .timeout(TIMEOUT)
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();
    try {
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new UpstreamWriteException(label + "返回错误（" + response.statusCode() + "）");
      }
      return parseBody(response.body(), label);
    } catch (UpstreamWriteException failure) {
      throw failure;
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      throw new UpstreamWriteException(label + "响应解析失败", corrupted);
    } catch (java.io.IOException failure) {
      throw new UpstreamWriteException("无法连接" + label + "，请稍后重试", failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new UpstreamWriteException(label + "调用被中断，请重试", interrupted);
    }
  }

  /** GET 上游目录并解析 JSON 响应体；透传 X-Tenant-Id（M5 租户上下文贯通门户→各软件）。 */
  public JsonNode get(String baseUrl, String path, String label) {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header(TenantContext.HEADER, TenantContext.current())
            .timeout(TIMEOUT)
            .GET()
            .build();
    try {
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalArgumentException(label + "返回错误（" + response.statusCode() + "）");
      }
      return parseBody(response.body(), label);
    } catch (com.fasterxml.jackson.core.JsonProcessingException corrupted) {
      // JsonProcessingException 是 IOException 子类：解析失败先于连接失败被捕获，给出准确中文提示
      throw new IllegalArgumentException(label + "响应解析失败");
    } catch (java.io.IOException failure) {
      throw new IllegalArgumentException("无法连接" + label + "，请稍后重试");
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalArgumentException(label + "查询被中断，请重试");
    }
  }

  private JsonNode parseBody(String body, String label)
      throws com.fasterxml.jackson.core.JsonProcessingException {
    if (body == null || body.isBlank()) {
      return objectMapper.createObjectNode();
    }
    return objectMapper.readTree(body);
  }
}
