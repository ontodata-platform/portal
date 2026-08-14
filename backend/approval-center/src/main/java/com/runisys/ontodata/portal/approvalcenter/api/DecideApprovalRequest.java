package com.runisys.ontodata.portal.approvalcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 审批决策请求：PENDING 状态才能决策；终态重复决策返回 409。 */
public class DecideApprovalRequest {

  @NotBlank(message = "审批结论不能为空")
  @Pattern(regexp = "APPROVED|REJECTED", message = "审批结论只能是 APPROVED 或 REJECTED")
  private String decision;

  @NotBlank(message = "审批人不能为空")
  @Size(max = 64, message = "审批人不能超过 64 个字符")
  private String decisionBy;

  @Size(max = 500, message = "审批意见不能超过 500 个字符")
  private String decisionNote;

  public String getDecision() {
    return decision;
  }

  public void setDecision(String decision) {
    this.decision = decision;
  }

  public String getDecisionBy() {
    return decisionBy;
  }

  public void setDecisionBy(String decisionBy) {
    this.decisionBy = decisionBy;
  }

  public String getDecisionNote() {
    return decisionNote;
  }

  public void setDecisionNote(String decisionNote) {
    this.decisionNote = decisionNote;
  }
}
