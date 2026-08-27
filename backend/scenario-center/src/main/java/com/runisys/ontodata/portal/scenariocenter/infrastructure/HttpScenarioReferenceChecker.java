package com.runisys.ontodata.portal.scenariocenter.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import com.runisys.ontodata.portal.scenariocenter.application.ScenarioReferenceChecker;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 场景引用存在性 HTTP 回查（发布前逐绑定调用权威源系统契约端点）。
 *
 * <p>路由（按 bindings[].sourceSystem）：
 *
 * <ul>
 *   <li>ALGORITHM_TRANSFORM → GET /api/v1/catalog/admissions?code=&version=（能力目录准入回查， 响应严格校验
 *       code/version 回显一致 + admitted 布尔，与 recombine 回查模式同构）；
 *   <li>ALGORITHM_RECOMBINE → GET /api/v1/workflow-templates?keyword= 找到同 code 且 PUBLISHED 的模板， 再
 *       GET /{id}/versions 校验存在 versionNumber 等于钉扎版本 major 位的编排版本 （重组平台版本号为服务端递增整数，场景契约钉扎 x.y.z，约定
 *       major 位对应该整数版本）；
 *   <li>DATA_PLATFORM（DATA_SNAPSHOT）→ GET /api/v1/metadata-snapshots/{snapshotId}/status（D3 已冻结），
 *       仅 status=READY 放行；404/REVOKED/EXPIRED/不可达一律 fail-closed。
 * </ul>
 *
 * <p>fail-closed：不可达/超时/非 2xx/响应结构非法/引用不存在一律抛 IllegalArgumentException 阻断发布。
 * 宽松模式（ontodata.scenario.reference-check.enabled=false）整体跳过，仅供离线开发，严禁生产。
 */
@Component
public class HttpScenarioReferenceChecker implements ScenarioReferenceChecker {

  private static final Duration TIMEOUT = Duration.ofSeconds(5);

  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final boolean enabled;
  private final String transformBaseUrl;
  private final String recombineBaseUrl;
  private final String dataPlatformBaseUrl;

  public HttpScenarioReferenceChecker(
      ObjectMapper objectMapper,
      @Value("${ontodata.scenario.reference-check.enabled:true}") boolean enabled,
      @Value("${ontodata.upstream.transform.base-url:http://127.0.0.1:18082}")
          String transformBaseUrl,
      @Value("${ontodata.upstream.recombine.base-url:http://127.0.0.1:18083}")
          String recombineBaseUrl,
      @Value("${ontodata.upstream.data-platform.base-url:http://127.0.0.1:18081}")
          String dataPlatformBaseUrl) {
    this.objectMapper = objectMapper;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    this.enabled = enabled;
    this.transformBaseUrl = transformBaseUrl;
    this.recombineBaseUrl = recombineBaseUrl;
    this.dataPlatformBaseUrl = dataPlatformBaseUrl;
  }

  @Override
  public void checkAll(List<BindingRequest> bindings) {
    if (!enabled) {
      return;
    }
    for (BindingRequest binding : bindings) {
      switch (binding.getType()) {
        case "CAPABILITY" -> checkCapability(binding.getRef(), binding.getVersion());
        case "WORKFLOW_TEMPLATE" -> checkWorkflowTemplate(binding.getRef(), binding.getVersion());
        case "DATA_SNAPSHOT" -> checkDataSnapshot(binding.getRef());
        default -> throw new IllegalArgumentException("不支持的场景绑定类型：" + binding.getType());
      }
    }
  }

  /** 能力引用回查：404=能力或版本不存在；200 严格校验回显一致且 admitted=true。 */
  private void checkCapability(String code, String version) {
    JsonNode body =
        get(
            transformBaseUrl,
            "/api/v1/catalog/admissions?code=" + encode(code) + "&version=" + encode(version),
            "算法转换工具能力目录");
    if (body == null) {
      throw new IllegalArgumentException("能力引用不存在：" + code + "@" + version);
    }
    JsonNode echoedCode = body.get("code");
    JsonNode echoedVersion = body.get("version");
    JsonNode admitted = body.get("admitted");
    if (echoedCode == null
        || !echoedCode.isTextual()
        || echoedVersion == null
        || !echoedVersion.isTextual()
        || admitted == null
        || !admitted.isBoolean()) {
      throw new IllegalArgumentException("算法转换工具能力目录响应结构非法，能力引用校验失败");
    }
    if (!code.equals(echoedCode.asText()) || !version.equals(echoedVersion.asText())) {
      throw new IllegalArgumentException("算法转换工具能力目录响应与请求不一致，能力引用校验失败");
    }
    if (!admitted.asBoolean()) {
      throw new IllegalArgumentException("能力版本未准入，不允许装配：" + code + "@" + version);
    }
  }

  /** 工作流模板回查：模板存在且 PUBLISHED，且存在 major 位与钉扎版本一致的编排版本。 */
  private void checkWorkflowTemplate(String code, String version) {
    JsonNode page =
        get(
            recombineBaseUrl,
            "/api/v1/workflow-templates?keyword=" + encode(code) + "&size=50",
            "算法重组平台工作流模板目录");
    if (page == null || !page.isObject() || !page.has("items") || !page.get("items").isArray()) {
      throw new IllegalArgumentException("算法重组平台工作流模板目录响应结构非法，模板引用校验失败");
    }
    JsonNode template = null;
    for (JsonNode item : page.get("items")) {
      JsonNode itemCode = item.get("code");
      if (itemCode != null && itemCode.isTextual() && code.equals(itemCode.asText())) {
        template = item;
        break;
      }
    }
    if (template == null) {
      throw new IllegalArgumentException("工作流模板不存在：" + code);
    }
    JsonNode status = template.get("status");
    JsonNode id = template.get("id");
    if (status == null || !status.isTextual() || id == null || !id.isTextual()) {
      throw new IllegalArgumentException("算法重组平台工作流模板目录响应结构非法，模板引用校验失败");
    }
    if (!"PUBLISHED".equals(status.asText())) {
      throw new IllegalArgumentException("工作流模板未发布，不允许装配：" + code);
    }
    int expectedVersionNumber = majorOf(version);
    JsonNode versions =
        get(
            recombineBaseUrl,
            "/api/v1/workflow-templates/" + encode(id.asText()) + "/versions",
            "算法重组平台工作流模板目录");
    if (versions == null || !versions.isArray()) {
      throw new IllegalArgumentException("算法重组平台工作流模板版本链响应结构非法，模板引用校验失败");
    }
    for (JsonNode item : versions) {
      JsonNode versionNumber = item.get("versionNumber");
      if (versionNumber != null
          && versionNumber.isInt()
          && versionNumber.asInt() == expectedVersionNumber) {
        return;
      }
    }
    throw new IllegalArgumentException(
        "工作流模板版本不存在：" + code + "@" + version + "（重组平台整数版本号 " + expectedVersionNumber + "）");
  }

  /**
   * 数据快照回查：权威端点 GET /api/v1/metadata-snapshots/{snapshotId}/status；仅 READY 放行。
   * 快照 id 含 "/" 视为非法引用（防路径穿越）。
   */
  private void checkDataSnapshot(String snapshotId) {
    if (snapshotId == null || snapshotId.isBlank() || snapshotId.contains("/")) {
      throw new IllegalArgumentException("数据快照引用非法（应为快照 id）：" + snapshotId);
    }
    JsonNode body =
        get(
            dataPlatformBaseUrl,
            "/api/v1/metadata-snapshots/" + encode(snapshotId) + "/status",
            "数据平台");
    if (body == null) {
      throw new IllegalArgumentException("数据快照不存在：" + snapshotId);
    }
    JsonNode status = body.get("status");
    if (status == null || !status.isTextual()) {
      throw new IllegalArgumentException("数据平台响应缺少 status 字段，快照引用校验失败");
    }
    if (!"READY".equals(status.asText())) {
      throw new IllegalArgumentException("数据快照状态未就绪（" + status.asText() + "）：" + snapshotId);
    }
  }

  /** 钉扎版本 x.y.z 的 major 位：对应重组平台服务端递增的整数编排版本号。 */
  private int majorOf(String version) {
    return Integer.parseInt(version.substring(0, version.indexOf('.')));
  }

  /** GET 上游并解析 JSON；404 返回 null（引用不存在），其余非 2xx/不可达 fail-closed 抛错。 */
  private JsonNode get(String baseUrl, String path, String label) {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .header(TenantContext.HEADER, TenantContext.current())
            .timeout(TIMEOUT)
            .GET()
            .build();
    final HttpResponse<String> response;
    try {
      response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (java.io.IOException failure) {
      throw new IllegalArgumentException("无法连接" + label + "，引用校验失败，请稍后重试");
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalArgumentException(label + "引用校验被中断，请重试");
    }
    if (response.statusCode() == 404) {
      return null;
    }
    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new IllegalArgumentException(label + "返回错误（" + response.statusCode() + "），引用校验失败");
    }
    try {
      return objectMapper.readTree(response.body());
    } catch (com.fasterxml.jackson.core.JsonProcessingException malformed) {
      throw new IllegalArgumentException(label + "响应不是合法 JSON，引用校验失败");
    }
  }

  private String encode(String value) {
    try {
      return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    } catch (UnsupportedEncodingException impossible) {
      throw new IllegalStateException("URL 编码失败", impossible);
    }
  }
}
