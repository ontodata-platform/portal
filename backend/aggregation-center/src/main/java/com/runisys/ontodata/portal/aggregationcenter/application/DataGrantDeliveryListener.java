package com.runisys.ontodata.portal.aggregationcenter.application;

import com.runisys.ontodata.portal.approvalcenter.application.ApprovalDecidedApplicationEvent;
import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 数据授权审批通过后投递管理平台订阅。失败只记审批 detail，不回滚终态。
 *
 * <p>用同步 {@link EventListener} 而不是 AFTER_COMMIT：监听器吞掉投递异常，审批决定已写入的
 * 终态不会因订阅失败回滚；测试与无事务边界的调用也能投递。
 */
@Component
public class DataGrantDeliveryListener {

  private static final Logger LOGGER = LoggerFactory.getLogger(DataGrantDeliveryListener.class);

  private final MarketplaceService marketplaceService;

  public DataGrantDeliveryListener(MarketplaceService marketplaceService) {
    this.marketplaceService = marketplaceService;
  }

  @EventListener
  public void onApprovalDecided(ApprovalDecidedApplicationEvent event) {
    if (!MarketplaceService.APPROVAL_TYPE_DATA_GRANT.equals(event.getApprovalType())) {
      return;
    }
    if (!ApprovalRequest.STATUS_APPROVED.equals(event.getDecision())) {
      return;
    }
    try {
      marketplaceService.retryDelivery(event.getApprovalCode());
    } catch (RuntimeException failure) {
      LOGGER.warn("数据授权订阅投递失败：{}", failure.getMessage());
    }
  }
}
