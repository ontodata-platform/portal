package com.runisys.ontodata.portal.scenariocenter.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/**
 * 场景创建/草稿更新请求（scenario/v1 契约装配形状）。
 *
 * <p>钉扎不变量在注解层强制：bindings[].version 与 ontologyRefs[].version 一律要求精确语义版本 x.y.z——`latest`/通配符在 bean
 * validation 即被拒（与契约负例 bad-latest-pin / bad-latest-ontology-ref 一致）；跨字段约束（bindings 至少一条、widget
 * 别名必须指向 bindings[].alias）由服务层校验。
 */
public class UpsertScenarioRequest {

  /** 精确语义版本：禁止 latest/通配符（执行可复现性要求全部精确钉扎）。 */
  public static final String SEMVER_PATTERN = "^\\d+\\.\\d+\\.\\d+$";

  public static final String SEMVER_MESSAGE = "版本必须钉扎精确语义版本 x.y.z（禁止 latest/通配符）";

  @NotBlank(message = "场景名称不能为空")
  @Size(max = 128, message = "场景名称不能超过 128 个字符")
  private String name;

  @Size(max = 1024, message = "场景描述不能超过 1024 个字符")
  private String description;

  @Pattern(regexp = "^[a-z0-9-]{1,64}$", message = "项目标识只能包含小写字母、数字与连字符（1-64 位）")
  private String projectId;

  @Valid private List<OntologyRefRequest> ontologyRefs;

  @NotEmpty(message = "装配绑定不能为空（bindings 至少一条）")
  @Valid
  private List<BindingRequest> bindings;

  @Valid private PresentationRequest presentation;

  @Size(max = 64, message = "创建人不能超过 64 个字符")
  private String createdBy;

  /** 本体发布包引用（ontology/package 契约）：version 精确钉扎。 */
  public static class OntologyRefRequest {

    @NotBlank(message = "本体包编码不能为空")
    @Pattern(regexp = "^pkg-[a-z0-9-]{1,64}$", message = "本体包编码必须是 pkg-* 形式")
    private String packageCode;

    @NotBlank(message = "本体包版本不能为空")
    @Pattern(regexp = SEMVER_PATTERN, message = SEMVER_MESSAGE)
    private String version;

    public String getPackageCode() {
      return packageCode;
    }

    public void setPackageCode(String packageCode) {
      this.packageCode = packageCode;
    }

    public String getVersion() {
      return version;
    }

    public void setVersion(String version) {
      this.version = version;
    }
  }

  /** 装配绑定：数据快照 / 能力版本 / 工作流模板版本，version 精确钉扎。 */
  public static class BindingRequest {

    @NotBlank(message = "绑定类型不能为空")
    @Pattern(
        regexp = "DATA_SNAPSHOT|CAPABILITY|WORKFLOW_TEMPLATE",
        message = "绑定类型只能是 DATA_SNAPSHOT、CAPABILITY 或 WORKFLOW_TEMPLATE")
    private String type;

    @NotBlank(message = "绑定引用编码不能为空")
    @Size(max = 128, message = "绑定引用编码不能超过 128 个字符")
    private String ref;

    @NotBlank(message = "绑定版本不能为空")
    @Pattern(regexp = SEMVER_PATTERN, message = SEMVER_MESSAGE)
    private String version;

    @Pattern(regexp = "^[a-z][a-zA-Z0-9_]{0,63}$", message = "绑定别名必须以小写字母开头，只含字母数字下划线")
    private String alias;

    @NotBlank(message = "权威源系统不能为空")
    @Pattern(
        regexp = "DATA_PLATFORM|ALGORITHM_TRANSFORM|ALGORITHM_RECOMBINE",
        message = "权威源系统只能是 DATA_PLATFORM、ALGORITHM_TRANSFORM 或 ALGORITHM_RECOMBINE")
    private String sourceSystem;

    public String getType() {
      return type;
    }

    public void setType(String type) {
      this.type = type;
    }

    public String getRef() {
      return ref;
    }

    public void setRef(String ref) {
      this.ref = ref;
    }

    public String getVersion() {
      return version;
    }

    public void setVersion(String version) {
      this.version = version;
    }

    public String getAlias() {
      return alias;
    }

    public void setAlias(String alias) {
      this.alias = alias;
    }

    public String getSourceSystem() {
      return sourceSystem;
    }

    public void setSourceSystem(String sourceSystem) {
      this.sourceSystem = sourceSystem;
    }
  }

  /** 展示配置（可选）：门户渲染场景页面的最小声明。 */
  public static class PresentationRequest {

    @Size(max = 128, message = "入口视图标识不能超过 128 个字符")
    private String entryView;

    @Valid private List<WidgetRequest> widgets;

    public String getEntryView() {
      return entryView;
    }

    public void setEntryView(String entryView) {
      this.entryView = entryView;
    }

    public List<WidgetRequest> getWidgets() {
      return widgets;
    }

    public void setWidgets(List<WidgetRequest> widgets) {
      this.widgets = widgets;
    }
  }

  public static class WidgetRequest {

    @NotBlank(message = "组件类型不能为空")
    @Pattern(
        regexp = "TABLE|CHART|METRIC|REPORT_LINK",
        message = "组件类型只能是 TABLE、CHART、METRIC 或 REPORT_LINK")
    private String kind;

    @NotBlank(message = "组件必须指向绑定别名（bindings[].alias）")
    private String bindingAlias;

    private Map<String, Object> config;

    public String getKind() {
      return kind;
    }

    public void setKind(String kind) {
      this.kind = kind;
    }

    public String getBindingAlias() {
      return bindingAlias;
    }

    public void setBindingAlias(String bindingAlias) {
      this.bindingAlias = bindingAlias;
    }

    public Map<String, Object> getConfig() {
      return config;
    }

    public void setConfig(Map<String, Object> config) {
      this.config = config;
    }
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getProjectId() {
    return projectId;
  }

  public void setProjectId(String projectId) {
    this.projectId = projectId;
  }

  public List<OntologyRefRequest> getOntologyRefs() {
    return ontologyRefs;
  }

  public void setOntologyRefs(List<OntologyRefRequest> ontologyRefs) {
    this.ontologyRefs = ontologyRefs;
  }

  public List<BindingRequest> getBindings() {
    return bindings;
  }

  public void setBindings(List<BindingRequest> bindings) {
    this.bindings = bindings;
  }

  public PresentationRequest getPresentation() {
    return presentation;
  }

  public void setPresentation(PresentationRequest presentation) {
    this.presentation = presentation;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(String createdBy) {
    this.createdBy = createdBy;
  }
}
