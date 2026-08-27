package com.runisys.ontodata.portal.aggregationcenter.api;

import com.runisys.ontodata.portal.aggregationcenter.application.MarketplaceService;
import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 数据商城聚合：目录/详情只读降级；申请创建审批，通过后投递订阅。 */
@RestController
@RequestMapping("/api/v1/marketplace")
public class MarketplaceController {

  private final MarketplaceService marketplaceService;

  public MarketplaceController(MarketplaceService marketplaceService) {
    this.marketplaceService = marketplaceService;
  }

  @GetMapping("/data-services")
  public UpstreamAggregationResponse dataServices(@Valid PageRequestParameters parameters) {
    return marketplaceService.dataServices(parameters);
  }

  @GetMapping("/data-services/{code}")
  public UpstreamAggregationResponse dataService(@PathVariable String code) {
    return marketplaceService.dataService(code);
  }

  @PostMapping("/data-services/{code}/apply")
  @ResponseStatus(HttpStatus.CREATED)
  public MarketplaceApplyResponse apply(
      @PathVariable String code, @Valid @RequestBody(required = false) ApplyDataServiceRequest request) {
    return marketplaceService.apply(
        code, request == null ? new ApplyDataServiceRequest() : request);
  }

  @PostMapping("/applications/{approvalCode}/retry-delivery")
  public ApprovalRequestResponse retryDelivery(@PathVariable String approvalCode) {
    return marketplaceService.retryDelivery(approvalCode);
  }
}
