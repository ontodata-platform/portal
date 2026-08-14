package com.runisys.ontodata.portal.resultcenter.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/** 结果登记请求：来源系统与结果标识由接口路径提供（可追踪率 100% 的强制约束）。 */
public class RegisterPortalResultRequest {

  @NotBlank(message = "结果类型不能为空")
  @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}", message = "结果类型格式不正确")
  private String resultType;

  /** 引用的资源编码（ds-/qr-/cap-/exe- 等跨软件稳定编码）。 */
  private List<String> resourceRefs;

  /** 结果元数据（名称、格式、大小、所属目录等，原样存储）。 */
  private Map<String, Object> metadata;

  @Size(max = 128, message = "来源任务标识不能超过 128 个字符")
  private String sourceTaskId;

  @Size(max = 128, message = "链路标识不能超过 128 个字符")
  private String traceId;

  public String getResultType() {
    return resultType;
  }

  public void setResultType(String resultType) {
    this.resultType = resultType;
  }

  public List<String> getResourceRefs() {
    return resourceRefs;
  }

  public void setResourceRefs(List<String> resourceRefs) {
    this.resourceRefs = resourceRefs;
  }

  public Map<String, Object> getMetadata() {
    return metadata;
  }

  public void setMetadata(Map<String, Object> metadata) {
    this.metadata = metadata;
  }

  public String getSourceTaskId() {
    return sourceTaskId;
  }

  public void setSourceTaskId(String sourceTaskId) {
    this.sourceTaskId = sourceTaskId;
  }

  public String getTraceId() {
    return traceId;
  }

  public void setTraceId(String traceId) {
    this.traceId = traceId;
  }
}
