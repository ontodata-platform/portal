package com.runisys.ontodata.portal.requirementcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 需求登记请求：需求类型三种（数据/算法/综合），去重键由服务端归一化标题生成。 */
public class CreateRequirementRequest {

  @NotBlank(message = "需求类型不能为空")
  @Pattern(
      regexp = "DATA|ALGORITHM|COMPREHENSIVE",
      message = "需求类型只能是 DATA、ALGORITHM 或 COMPREHENSIVE")
  private String requirementType;

  @NotBlank(message = "需求标题不能为空")
  @Size(max = 200, message = "需求标题不能超过 200 个字符")
  private String title;

  @Size(max = 5000, message = "需求描述不能超过 5000 个字符")
  private String description;

  @NotBlank(message = "提出人不能为空")
  @Size(max = 64, message = "提出人不能超过 64 个字符")
  private String requester;

  public String getRequirementType() {
    return requirementType;
  }

  public void setRequirementType(String requirementType) {
    this.requirementType = requirementType;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getRequester() {
    return requester;
  }

  public void setRequester(String requester) {
    this.requester = requester;
  }
}
