package com.runisys.ontodata.portal.aggregationcenter.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.runisys.ontodata.portal.aggregationcenter.api.SubmitWorkbenchRunRequest;
import com.runisys.ontodata.portal.aggregationcenter.api.UpstreamAggregationResponse;
import com.runisys.ontodata.portal.aggregationcenter.api.WorkbenchRunResponse;
import com.runisys.ontodata.portal.aggregationcenter.infrastructure.UpstreamHttpClient;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.sdk.web.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.UpstreamWriteException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 算法工作台聚合服务（总体设计 §5 算法服务入口）：读取算法转换工具能力目录 （cap-* 已发布能力）与算法重组平台工作流模板目录（wf-* 已发布版本）。
 *
 * <p>门户只透传目录条目；运行边界（只引用已准入能力版本）由重组平台发布校验把关， 门户不复制该规则。上游不可用时降级展示（available=false），不阻断其他页面。
 */
@Service
public class WorkbenchService {

  private static final String LABEL_TRANSFORM = "算法转换工具";
  private static final String LABEL_RECOMBINE = "算法重组平台";

  private final UpstreamHttpClient upstreamHttpClient;
  private final String transformBaseUrl;
  private final String recombineBaseUrl;

  public WorkbenchService(
      UpstreamHttpClient upstreamHttpClient,
      @Value("${ontodata.upstream.transform.base-url:http://127.0.0.1:18082}")
          String transformBaseUrl,
      @Value("${ontodata.upstream.recombine.base-url:http://127.0.0.1:18083}")
          String recombineBaseUrl) {
    this.upstreamHttpClient = upstreamHttpClient;
    this.transformBaseUrl = transformBaseUrl;
    this.recombineBaseUrl = recombineBaseUrl;
  }

  public UpstreamAggregationResponse capabilities(PageRequestParameters parameters) {
    return fetch(
        "algorithm-transform",
        LABEL_TRANSFORM,
        transformBaseUrl,
        "/api/v1/capabilities",
        parameters);
  }

  public UpstreamAggregationResponse workflowTemplates(PageRequestParameters parameters) {
    return fetch(
        "algorithm-recombine",
        LABEL_RECOMBINE,
        recombineBaseUrl,
        "/api/v1/workflow-templates",
        parameters);
  }

  public UpstreamAggregationResponse capability(String code) {
    return findOne(
        "algorithm-transform", LABEL_TRANSFORM, transformBaseUrl, "/api/v1/capabilities", code);
  }

  public UpstreamAggregationResponse workflowTemplate(String code) {
    return findOne(
        "algorithm-recombine",
        LABEL_RECOMBINE,
        recombineBaseUrl,
        "/api/v1/workflow-templates",
        code);
  }

  public WorkbenchRunResponse run(String code, SubmitWorkbenchRunRequest request) {
    JsonNode item;
    try {
      item = requireItem(recombineBaseUrl, "/api/v1/workflow-templates", LABEL_RECOMBINE, code);
    } catch (IllegalArgumentException failure) {
      throw new UpstreamWriteException(LABEL_RECOMBINE + "目录不可用：" + failure.getMessage(), failure);
    }
    String templateId = CatalogLookup.resolveId(item, code);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("templateId", templateId);
    body.put("templateVersion", request.getTemplateVersion());
    if (request.getResourceRefs() != null) {
      body.put("resourceRefs", request.getResourceRefs());
    }
    if (request.getOntologyRuntimeContractVersion() != null) {
      body.put("ontologyRuntimeContractVersion", request.getOntologyRuntimeContractVersion());
    }
    if (request.getDataSnapshotVersion() != null) {
      body.put("dataSnapshotVersion", request.getDataSnapshotVersion());
    }
    JsonNode submitted =
        upstreamHttpClient.post(recombineBaseUrl, "/api/v1/executions", body, LABEL_RECOMBINE);
    String taskId =
        CatalogLookup.text(submitted, "taskId") != null
            ? CatalogLookup.text(submitted, "taskId")
            : CatalogLookup.text(submitted, "id");
    if (taskId == null || taskId.isBlank()) {
      throw new UpstreamWriteException("算法重组平台未返回任务标识");
    }
    String status = CatalogLookup.text(submitted, "status");
    boolean started = true;
    try {
      upstreamHttpClient.post(
          recombineBaseUrl, "/api/v1/executions/" + taskId + "/start", Map.of(), LABEL_RECOMBINE);
    } catch (UpstreamWriteException | IllegalArgumentException startFailed) {
      started = false;
    }
    return new WorkbenchRunResponse(taskId, status, started);
  }

  private UpstreamAggregationResponse findOne(
      String sourceSystem, String label, String baseUrl, String path, String code) {
    try {
      return UpstreamAggregationResponse.available(
          sourceSystem, requireItem(baseUrl, path, label, code));
    } catch (IllegalArgumentException failure) {
      return UpstreamAggregationResponse.unavailable(sourceSystem, label + "目录不可用：" + failure.getMessage());
    }
  }

  private JsonNode requireItem(String baseUrl, String path, String label, String code) {
    PageRequestParameters parameters = new PageRequestParameters();
    parameters.setKeyword(code);
    JsonNode body = upstreamHttpClient.get(baseUrl, path + "?" + queryString(parameters), label);
    JsonNode item = CatalogLookup.findItem(body, code);
    if (item == null) {
      throw new ResourceNotFoundException("目录条目不存在：" + code);
    }
    return item;
  }

  private UpstreamAggregationResponse fetch(
      String sourceSystem,
      String label,
      String baseUrl,
      String path,
      PageRequestParameters parameters) {
    try {
      return UpstreamAggregationResponse.available(
          sourceSystem,
          upstreamHttpClient.get(baseUrl, path + "?" + queryString(parameters), label));
    } catch (IllegalArgumentException failure) {
      return UpstreamAggregationResponse.unavailable(
          sourceSystem, label + "目录不可用：" + failure.getMessage());
    }
  }

  /** 门户与各软件分页协议同构（page/size/keyword/status/type/domain），原样透传。 */
  private String queryString(PageRequestParameters parameters) {
    List<String> parts = new ArrayList<>();
    parts.add("page=" + parameters.getPage());
    parts.add("size=" + parameters.getSize());
    if (parameters.getKeyword() != null) {
      parts.add("keyword=" + encode(parameters.getKeyword()));
    }
    if (parameters.getStatus() != null) {
      parts.add("status=" + encode(parameters.getStatus()));
    }
    if (parameters.getType() != null) {
      parts.add("type=" + encode(parameters.getType()));
    }
    if (parameters.getDomain() != null) {
      parts.add("domain=" + encode(parameters.getDomain()));
    }
    return String.join("&", parts);
  }

  private String encode(String value) {
    try {
      return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    } catch (UnsupportedEncodingException impossible) {
      throw new IllegalStateException("URL 编码失败", impossible);
    }
  }
}
