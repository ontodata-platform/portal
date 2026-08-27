package com.runisys.ontodata.portal.aggregationcenter.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.runisys.ontodata.portal.aggregationcenter.api.ApplyDataServiceRequest;
import com.runisys.ontodata.portal.aggregationcenter.api.MarketplaceApplyResponse;
import com.runisys.ontodata.portal.aggregationcenter.api.UpstreamAggregationResponse;
import com.runisys.ontodata.portal.aggregationcenter.infrastructure.UpstreamHttpClient;
import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.approvalcenter.api.CreateApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.application.ApprovalService;
import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.common.api.UpstreamWriteException;
import com.runisys.ontodata.portal.common.security.CurrentOperator;
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
 * 数据商城聚合服务（总体设计 §5 数据服务入口）：读取管理平台正式 REST 契约的数据服务目录。
 *
 * <p>降级策略：上游不可用/错误时返回 available=false + 中文提示（200），不阻断门户其他
 * 页面；门户只透传目录条目（code/name/status/version），详情跳转由各软件页面承接。
 */
@Service
public class MarketplaceService {

  private static final String SOURCE_SYSTEM = "data-platform";
  private static final String LABEL = "管理平台";

  static final String APPROVAL_TYPE_DATA_GRANT = "DATA_GRANT";

  private final UpstreamHttpClient upstreamHttpClient;
  private final ApprovalService approvalService;
  private final String dataPlatformBaseUrl;

  public MarketplaceService(
      UpstreamHttpClient upstreamHttpClient,
      ApprovalService approvalService,
      @Value("${ontodata.upstream.data-platform.base-url:http://127.0.0.1:18081}")
          String dataPlatformBaseUrl) {
    this.upstreamHttpClient = upstreamHttpClient;
    this.approvalService = approvalService;
    this.dataPlatformBaseUrl = dataPlatformBaseUrl;
  }

  public UpstreamAggregationResponse dataServices(PageRequestParameters parameters) {
    return fetch(parameters, "/api/v1/data-services");
  }

  public UpstreamAggregationResponse dataService(String code) {
    try {
      JsonNode item = requireCatalogItem(code);
      return UpstreamAggregationResponse.available(SOURCE_SYSTEM, item);
    } catch (IllegalArgumentException failure) {
      return UpstreamAggregationResponse.unavailable(
          SOURCE_SYSTEM, LABEL + "数据服务目录不可用：" + failure.getMessage());
    }
  }

  public MarketplaceApplyResponse apply(String code, ApplyDataServiceRequest request) {
    JsonNode item;
    try {
      item = requireCatalogItem(code);
    } catch (IllegalArgumentException failure) {
      throw new UpstreamWriteException(LABEL + "数据服务目录不可用：" + failure.getMessage(), failure);
    }
    String serviceId = CatalogLookup.resolveId(item, code);
    Map<String, Object> detail = new LinkedHashMap<>();
    detail.put("serviceCode", code);
    detail.put("serviceId", serviceId);
    detail.put(
        "grantedColumns",
        request.getGrantedColumns() == null ? List.of() : request.getGrantedColumns());
    detail.put("deliveryStatus", "PENDING");
    CreateApprovalRequest create = new CreateApprovalRequest();
    create.setApprovalType(APPROVAL_TYPE_DATA_GRANT);
    create.setSourceSystem(SOURCE_SYSTEM);
    create.setSourceCode(code);
    create.setTitle("申请数据服务 " + CatalogLookup.text(item, "name"));
    create.setDetail(detail);
    ApprovalRequestResponse created = approvalService.create(create);
    return new MarketplaceApplyResponse(created.getCode(), created.getStatus());
  }

  public ApprovalRequestResponse retryDelivery(String approvalCode) {
    ApprovalRequestResponse approval = approvalService.find(approvalCode);
    if (!APPROVAL_TYPE_DATA_GRANT.equals(approval.getApprovalType())) {
      throw new IllegalArgumentException("只有数据授权申请可以重试投递");
    }
    if (!ApprovalRequest.STATUS_APPROVED.equals(approval.getStatus())) {
      throw new ResourceStateConflictException("审批尚未通过，不能投递订阅");
    }
    Object status = approval.getDetail() == null ? null : approval.getDetail().get("deliveryStatus");
    if ("SUCCEEDED".equals(status)) {
      return approval;
    }
    return deliver(approval);
  }

  ApprovalRequestResponse deliver(ApprovalRequestResponse approval) {
    Map<String, Object> detail =
        approval.getDetail() == null
            ? new LinkedHashMap<>()
            : new LinkedHashMap<>(approval.getDetail());
    Object serviceIdValue = detail.get("serviceId");
    if (serviceIdValue == null || serviceIdValue.toString().isBlank()) {
      return approval;
    }
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serviceId", serviceIdValue.toString());
    body.put("consumer", approval.getRequester() == null ? CurrentOperator.name() : approval.getRequester());
    Object columns = detail.get("grantedColumns");
    if (columns instanceof List<?> list) {
      body.put("grantedColumns", list);
    }
    try {
      JsonNode subscription =
          upstreamHttpClient.post(
              dataPlatformBaseUrl, "/api/v1/data-service-subscriptions", body, LABEL);
      detail.put("deliveryStatus", "SUCCEEDED");
      if (subscription.has("id")) {
        detail.put("subscriptionId", subscription.get("id").asText());
      }
      detail.remove("deliveryError");
    } catch (UpstreamWriteException | IllegalArgumentException failure) {
      detail.put("deliveryStatus", "FAILED");
      detail.put("deliveryError", failure.getMessage());
      approvalService.replaceDetail(approval.getCode(), detail);
      if (failure instanceof UpstreamWriteException write) {
        throw write;
      }
      throw new UpstreamWriteException(failure.getMessage(), failure);
    }
    return approvalService.replaceDetail(approval.getCode(), detail);
  }

  private JsonNode requireCatalogItem(String code) {
    PageRequestParameters parameters = new PageRequestParameters();
    parameters.setKeyword(code);
    parameters.setSize(20);
    JsonNode body =
        upstreamHttpClient.get(
            dataPlatformBaseUrl, "/api/v1/data-services?" + queryString(parameters), LABEL);
    JsonNode item = CatalogLookup.findItem(body, code);
    if (item == null) {
      throw new ResourceNotFoundException("数据服务不存在：" + code);
    }
    return item;
  }

  private UpstreamAggregationResponse fetch(PageRequestParameters parameters, String path) {
    try {
      return UpstreamAggregationResponse.available(
          SOURCE_SYSTEM,
          upstreamHttpClient.get(dataPlatformBaseUrl, path + "?" + queryString(parameters), LABEL));
    } catch (IllegalArgumentException failure) {
      return UpstreamAggregationResponse.unavailable(
          SOURCE_SYSTEM, LABEL + "数据服务目录不可用：" + failure.getMessage());
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
