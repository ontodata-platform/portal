package com.runisys.ontodata.portal.approvalcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;

/** 批量审批：每条独立裁决，终态/不存在记入 failed，不回滚已成功项。 */
public class BatchDecideRequest {

  @NotEmpty(message = "审批编码列表不能为空")
  @Size(max = 50, message = "单次批量审批不能超过 50 条")
  private List<String> codes = new ArrayList<String>();

  @NotBlank(message = "审批结论不能为空")
  @Pattern(regexp = "APPROVED|REJECTED", message = "审批结论只能是 APPROVED 或 REJECTED")
  private String decision;

  @Size(max = 64, message = "审批人不能超过 64 个字符")
  private String decisionBy;

  @Size(max = 500, message = "审批意见不能超过 500 个字符")
  private String decisionNote;

  public List<String> getCodes() {
    return codes;
  }

  public void setCodes(List<String> codes) {
    this.codes = codes == null ? new ArrayList<String>() : codes;
  }

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
