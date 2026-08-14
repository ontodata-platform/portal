package com.runisys.ontodata.portal.operationscenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 公告创建请求：草稿状态落库，走发布动作才对外可见。 */
public class CreateNoticeRequest {

  @NotBlank(message = "公告标题不能为空")
  @Size(max = 200, message = "公告标题不能超过 200 个字符")
  private String title;

  @NotBlank(message = "公告内容不能为空")
  private String content;

  @NotBlank(message = "栏目不能为空")
  @Size(max = 64, message = "栏目不能超过 64 个字符")
  private String section;

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

  public String getSection() {
    return section;
  }

  public void setSection(String section) {
    this.section = section;
  }
}
