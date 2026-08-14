package com.runisys.ontodata.portal.aggregationcenter.application;

import com.runisys.ontodata.portal.aggregationcenter.api.UpstreamAggregationResponse;
import com.runisys.ontodata.portal.aggregationcenter.infrastructure.UpstreamHttpClient;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
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

  private final UpstreamHttpClient upstreamHttpClient;
  private final String dataPlatformBaseUrl;

  public MarketplaceService(
      UpstreamHttpClient upstreamHttpClient,
      @Value("${ontodata.upstream.data-platform.base-url:http://127.0.0.1:18081}")
          String dataPlatformBaseUrl) {
    this.upstreamHttpClient = upstreamHttpClient;
    this.dataPlatformBaseUrl = dataPlatformBaseUrl;
  }

  public UpstreamAggregationResponse dataServices(PageRequestParameters parameters) {
    return fetch(parameters, "/api/v1/data-services");
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
