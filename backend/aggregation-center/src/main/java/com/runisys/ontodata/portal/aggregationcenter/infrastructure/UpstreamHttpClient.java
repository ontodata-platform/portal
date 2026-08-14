package com.runisys.ontodata.portal.aggregationcenter.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

  /** GET 上游目录并解析 JSON 响应体。 */
  public JsonNode get(String baseUrl, String path, String label) {
    HttpRequest request =
        HttpRequest.newBuilder().uri(URI.create(baseUrl + path)).timeout(TIMEOUT).GET().build();
    try {
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalArgumentException(label + "返回错误（" + response.statusCode() + "）");
      }
      String body = response.body();
      if (body == null || body.isBlank()) {
        return objectMapper.createObjectNode();
      }
      return objectMapper.readTree(body);
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
}
