package com.runisys.ontodata.portal.requirementcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** 需求分派请求：assigneeSystem 必须是平台内业务软件；assigneeRef 引用目标软件任务/对象编码， 门户只登记引用不复制数据；plan 可随分派一并落库。 */
public class AssignRequirementRequest {

  @NotBlank(message = "分派目标不能为空")
  @Pattern(regexp = "[a-z][a-z0-9\\-]{0,31}", message = "分派目标格式不正确")
  private String assigneeSystem;

  @Size(max = 128, message = "分派引用不能超过 128 个字符")
  private String assigneeRef;

  private Map<String, Object> plan;

  public String getAssigneeSystem() {
    return assigneeSystem;
  }

  public void setAssigneeSystem(String assigneeSystem) {
    this.assigneeSystem = assigneeSystem;
  }

  public String getAssigneeRef() {
    return assigneeRef;
  }

  public void setAssigneeRef(String assigneeRef) {
    this.assigneeRef = assigneeRef;
  }

  public Map<String, Object> getPlan() {
    return plan;
  }

  public void setPlan(Map<String, Object> plan) {
    this.plan = plan;
  }
}
