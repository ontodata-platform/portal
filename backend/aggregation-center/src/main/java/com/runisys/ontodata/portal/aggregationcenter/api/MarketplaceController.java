package com.runisys.ontodata.portal.aggregationcenter.api;

import com.runisys.ontodata.portal.aggregationcenter.application.MarketplaceService;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 数据商城聚合接口：经管理平台正式 REST 契约读取数据服务目录（门户只展示与引导， 申请/订阅在管理平台页面办理）。 */
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
}
