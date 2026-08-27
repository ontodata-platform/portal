package com.runisys.ontodata.portal.scenariocenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

/**
 * 场景（scenario/v1 契约，已冻结）：把已发布本体包、数据快照、能力版本与工作流模板版本 装配为可交付业务应用的一等对象。场景是引用聚合器，不拥有任何被引用资产——
 * ontologyRefsJson/bindingsJson 只存引用 + 精确钉扎版本（禁止 latest/通配符）。
 *
 * <p>不可变版本惯例：PUBLISHED 后该 (code, version) 对象不可变；修改产生新草稿版本 （服务端递增补丁号）。M5 多租户：唯一约束为 (tenant_id, code,
 * version) 复合。
 */
@Entity
@Table(
    name = "portal_scenario",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_portal_scenario_version",
          columnNames = {"tenant_id", "code", "version"})
    })
public class PortalScenario {

  public static final String STATUS_DRAFT = "DRAFT";
  public static final String STATUS_PUBLISHED = "PUBLISHED";
  public static final String STATUS_DEPRECATED = "DEPRECATED";

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  /** 稳定编码 scn-*：跨软件引用（mcp-gateway 场景工具、recombine 执行钉扎校验），生成后永不变更。 */
  @Column(nullable = false, updatable = false, length = 72)
  private String code;

  /** 不可变语义版本号 x.y.z：bindings 变更即新版本。 */
  @Column(nullable = false, updatable = false, length = 16)
  private String version;

  @Column(nullable = false, length = 128)
  private String name;

  @Column(length = 1024)
  private String description;

  @Column(name = "project_id", length = 64)
  private String projectId;

  @Column(nullable = false, length = 16)
  private String status;

  /** 本体发布包引用（[{packageCode, version}]，version 精确钉扎）。 */
  @Column(name = "ontology_refs_json", columnDefinition = "longtext")
  private String ontologyRefsJson;

  /** 装配绑定（[{type, ref, version, alias?, sourceSystem}]，version 精确钉扎，至少一条）。 */
  @Column(name = "bindings_json", nullable = false, columnDefinition = "longtext")
  private String bindingsJson;

  /** 展示配置（可选，{entryView, widgets[]}）。 */
  @Column(name = "presentation_json", columnDefinition = "longtext")
  private String presentationJson;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_by", length = 64)
  private String createdBy;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected PortalScenario() {}

  public PortalScenario(
      String code,
      String version,
      String name,
      String description,
      String projectId,
      String ontologyRefsJson,
      String bindingsJson,
      String presentationJson,
      String tenantId,
      String createdBy,
      Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.version = version;
    this.name = name;
    this.description = description;
    this.projectId = projectId;
    this.status = STATUS_DRAFT;
    this.ontologyRefsJson = ontologyRefsJson;
    this.bindingsJson = bindingsJson;
    this.presentationJson = presentationJson;
    this.tenantId = tenantId;
    this.createdBy = createdBy;
    this.createdAt = now;
    this.updatedAt = now;
  }

  /** 草稿内容更新：仅 DRAFT 允许（服务层先校验状态），装配字段整组替换。 */
  public void updateDraft(
      String name,
      String description,
      String projectId,
      String ontologyRefsJson,
      String bindingsJson,
      String presentationJson,
      Instant now) {
    this.name = name;
    this.description = description;
    this.projectId = projectId;
    this.ontologyRefsJson = ontologyRefsJson;
    this.bindingsJson = bindingsJson;
    this.presentationJson = presentationJson;
    this.updatedAt = now;
  }

  /** 状态流转：允许的目标状态由服务层白名单校验，此处只应用。 */
  public void transition(String target, Instant now) {
    this.status = target;
    this.updatedAt = now;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) createdAt = Instant.now();
    if (updatedAt == null) updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public String getId() {
    return id;
  }

  public String getCode() {
    return code;
  }

  public String getVersion() {
    return version;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getProjectId() {
    return projectId;
  }

  public String getStatus() {
    return status;
  }

  public String getOntologyRefsJson() {
    return ontologyRefsJson;
  }

  public String getBindingsJson() {
    return bindingsJson;
  }

  public String getPresentationJson() {
    return presentationJson;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
