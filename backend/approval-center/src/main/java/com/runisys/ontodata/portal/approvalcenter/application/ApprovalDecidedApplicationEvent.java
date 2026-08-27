package com.runisys.ontodata.portal.approvalcenter.application;

/**
 * 审批决定落库后的同进程事件（AFTER_COMMIT 投递 DATA_GRANT 订阅）。 外部系统仍走 Outbox 的 portal.approval.decided。
 */
public class ApprovalDecidedApplicationEvent {

  private final String approvalCode;
  private final String approvalType;
  private final String decision;
  private final String requester;
  private final String title;
  private final String tenantId;

  public ApprovalDecidedApplicationEvent(
      String approvalCode, String approvalType, String decision) {
    this(approvalCode, approvalType, decision, null, null, null);
  }

  public ApprovalDecidedApplicationEvent(
      String approvalCode,
      String approvalType,
      String decision,
      String requester,
      String title,
      String tenantId) {
    this.approvalCode = approvalCode;
    this.approvalType = approvalType;
    this.decision = decision;
    this.requester = requester;
    this.title = title;
    this.tenantId = tenantId;
  }

  public String getApprovalCode() {
    return approvalCode;
  }

  public String getApprovalType() {
    return approvalType;
  }

  public String getDecision() {
    return decision;
  }

  public String getRequester() {
    return requester;
  }

  public String getTitle() {
    return title;
  }

  public String getTenantId() {
    return tenantId;
  }
}
