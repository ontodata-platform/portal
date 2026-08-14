package com.runisys.ontodata.portal.common;

/** 请求级租户上下文：由 TenantContextFilter 从 X-Tenant-Id 请求头装载。 */
public final class TenantContext {

  public static final String DEFAULT_TENANT = "default";
  public static final String HEADER = "X-Tenant-Id";

  private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

  private TenantContext() {}

  /** 当前租户（M5 多租户基础）：IAM 接入后改为从认证上下文解析，接口形状不变。 */
  public static String current() {
    String tenantId = CURRENT.get();
    return tenantId == null ? DEFAULT_TENANT : tenantId;
  }

  public static void set(String tenantId) {
    CURRENT.set(tenantId);
  }

  public static void clear() {
    CURRENT.remove();
  }
}
