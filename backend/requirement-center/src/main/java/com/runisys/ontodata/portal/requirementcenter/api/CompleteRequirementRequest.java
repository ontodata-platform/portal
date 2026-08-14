package com.runisys.ontodata.portal.requirementcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 需求结项请求：结项说明必填（可追踪的闭环证据）。 */
public class CompleteRequirementRequest {

  @NotBlank(message = "结项说明不能为空")
  @Size(max = 500, message = "结项说明不能超过 500 个字符")
  private String closedNote;

  public String getClosedNote() {
    return closedNote;
  }

  public void setClosedNote(String closedNote) {
    this.closedNote = closedNote;
  }
}
