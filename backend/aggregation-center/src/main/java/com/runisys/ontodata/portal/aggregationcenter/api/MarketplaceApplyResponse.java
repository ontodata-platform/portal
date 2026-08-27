package com.runisys.ontodata.portal.aggregationcenter.api;

/** 商城申请结果：只创建审批，订阅在审批通过后投递。 */
public class MarketplaceApplyResponse {

  private final String approvalCode;
  private final String status;

  public MarketplaceApplyResponse(String approvalCode, String status) {
    this.approvalCode = approvalCode;
    this.status = status;
  }

  public String getApprovalCode() {
    return approvalCode;
  }

  public String getStatus() {
    return status;
  }
}
