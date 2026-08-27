package com.runisys.ontodata.portal.personalcenter.api;

import java.util.List;

/** 当前登录主体视图（门户产品化）：前端菜单与个人工作台只读展示。 */
public class PortalIdentityResponse {

  private final String name;
  private final String tenantId;
  private final String orgId;
  private final String projectId;
  private final List<String> roles;
  private final boolean devMode;

  public PortalIdentityResponse(
      String name,
      String tenantId,
      String orgId,
      String projectId,
      List<String> roles,
      boolean devMode) {
    this.name = name;
    this.tenantId = tenantId;
    this.orgId = orgId;
    this.projectId = projectId;
    this.roles = roles;
    this.devMode = devMode;
  }

  public String getName() {
    return name;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getOrgId() {
    return orgId;
  }

  public String getProjectId() {
    return projectId;
  }

  public List<String> getRoles() {
    return roles;
  }

  public boolean isDevMode() {
    return devMode;
  }
}
