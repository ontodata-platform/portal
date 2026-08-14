package com.runisys.ontodata.portal.requirementcenter.api;

import jakarta.validation.constraints.Size;

/** 需求取消请求：取消说明可选。 */
public class CancelRequirementRequest {

  @Size(max = 500, message = "取消说明不能超过 500 个字符")
  private String closedNote;

  public String getClosedNote() {
    return closedNote;
  }

  public void setClosedNote(String closedNote) {
    this.closedNote = closedNote;
  }
}
