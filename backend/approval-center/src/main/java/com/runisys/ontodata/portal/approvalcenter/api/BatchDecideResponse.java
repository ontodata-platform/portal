package com.runisys.ontodata.portal.approvalcenter.api;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** 批量审批结果：成功列表 + 失败列表，HTTP 始终 200。 */
public class BatchDecideResponse {

  private final String decision;
  private final List<ApprovalRequestResponse> succeeded;
  private final List<BatchDecideFailure> failed;

  public BatchDecideResponse(
      String decision,
      List<ApprovalRequestResponse> succeeded,
      List<BatchDecideFailure> failed) {
    this.decision = decision;
    this.succeeded = Collections.unmodifiableList(new ArrayList<ApprovalRequestResponse>(succeeded));
    this.failed = Collections.unmodifiableList(new ArrayList<BatchDecideFailure>(failed));
  }

  public String getDecision() {
    return decision;
  }

  public List<ApprovalRequestResponse> getSucceeded() {
    return succeeded;
  }

  public List<BatchDecideFailure> getFailed() {
    return failed;
  }
}
