package com.runisys.ontodata.portal.operationscenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 反馈创建请求：联系方式可选。 */
public class CreateFeedbackRequest {

  @NotBlank(message = "反馈标题不能为空")
  @Size(max = 200, message = "反馈标题不能超过 200 个字符")
  private String title;

  @NotBlank(message = "反馈内容不能为空")
  @Size(max = 2000, message = "反馈内容不能超过 2000 个字符")
  private String content;

  @Size(max = 200, message = "联系方式不能超过 200 个字符")
  private String contact;

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public String getContact() {
    return contact;
  }

  public void setContact(String contact) {
    this.contact = contact;
  }
}
