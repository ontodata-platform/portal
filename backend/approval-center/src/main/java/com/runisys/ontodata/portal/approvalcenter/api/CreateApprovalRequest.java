package com.runisys.ontodata.portal.approvalcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** 创建审批单请求。审批单由业务软件升级产生（如 MCP 网关 R4 工具确认卡升级）， sourceSystem/sourceCode 记录来源契约，供审批完成后回查。 */
public class CreateApprovalRequest {

  @NotBlank(message = "审批类型不能为空")
  @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}", message = "审批类型格式不正确")
  private String approvalType;

  @NotBlank(message = "来源系统不能为空")
  @Pattern(regexp = "[a-z][a-z0-9\\-]{0,31}", message = "来源系统只能是 1-32 位小写字母、数字或连字符")
  private String sourceSystem;

  @Size(max = 128, message = "来源对象编码不能超过 128 个字符")
  private String sourceCode;

  @NotBlank(message = "审批标题不能为空")
  @Size(max = 200, message = "审批标题不能超过 200 个字符")
  private String title;

  /** 审批上下文明细，原样存储（可包含工具名、参数摘要、风险分级等）。 */
  private Map<String, Object> detail;

  @NotBlank(message = "申请人不能为空")
  @Size(max = 64, message = "申请人不能超过 64 个字符")
  private String requester;

  public String getApprovalType() {
    return approvalType;
  }

  public void setApprovalType(String approvalType) {
    this.approvalType = approvalType;
  }

  public String getSourceSystem() {
    return sourceSystem;
  }

  public void setSourceSystem(String sourceSystem) {
    this.sourceSystem = sourceSystem;
  }

  public String getSourceCode() {
    return sourceCode;
  }

  public void setSourceCode(String sourceCode) {
    this.sourceCode = sourceCode;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public Map<String, Object> getDetail() {
    return detail;
  }

  public void setDetail(Map<String, Object> detail) {
    this.detail = detail;
  }

  public String getRequester() {
    return requester;
  }

  public void setRequester(String requester) {
    this.requester = requester;
  }
}
