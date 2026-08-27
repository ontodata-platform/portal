package com.runisys.ontodata.portal.aggregationcenter.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

/** 工作台提交运行：版本必填，其余转给重组平台。 */
public class SubmitWorkbenchRunRequest {

  @NotNull(message = "编排版本不能为空")
  @Min(value = 1, message = "编排版本必须大于等于 1")
  private Integer templateVersion;

  private Map<String, Object> resourceRefs;

  @Pattern(regexp = "^\\d+\\.\\d+$", message = "本体运行契约版本必须是 x.y 格式")
  @Size(max = 16, message = "本体运行契约版本过长")
  private String ontologyRuntimeContractVersion;

  @Size(max = 128, message = "数据快照版本引用过长")
  private String dataSnapshotVersion;

  public Integer getTemplateVersion() {
    return templateVersion;
  }

  public void setTemplateVersion(Integer templateVersion) {
    this.templateVersion = templateVersion;
  }

  public Map<String, Object> getResourceRefs() {
    return resourceRefs;
  }

  public void setResourceRefs(Map<String, Object> resourceRefs) {
    this.resourceRefs = resourceRefs;
  }

  public String getOntologyRuntimeContractVersion() {
    return ontologyRuntimeContractVersion;
  }

  public void setOntologyRuntimeContractVersion(String ontologyRuntimeContractVersion) {
    this.ontologyRuntimeContractVersion = ontologyRuntimeContractVersion;
  }

  public String getDataSnapshotVersion() {
    return dataSnapshotVersion;
  }

  public void setDataSnapshotVersion(String dataSnapshotVersion) {
    this.dataSnapshotVersion = dataSnapshotVersion;
  }
}
