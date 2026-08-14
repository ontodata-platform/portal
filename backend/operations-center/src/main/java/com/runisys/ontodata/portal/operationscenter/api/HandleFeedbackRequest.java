package com.runisys.ontodata.portal.operationscenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 反馈处理请求：处理说明必填（办理证据）。 */
public class HandleFeedbackRequest {

  @NotBlank(message = "处理说明不能为空")
  @Size(max = 500, message = "处理说明不能超过 500 个字符")
  private String handleNote;

  public String getHandleNote() {
    return handleNote;
  }

  public void setHandleNote(String handleNote) {
    this.handleNote = handleNote;
  }
}
