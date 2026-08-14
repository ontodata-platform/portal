package com.runisys.ontodata.portal.common;

import com.runisys.ontodata.portal.common.security.DataClassification;

/**
 * 请求级权限上下文（M5 ABAC 基础）：组织、项目与许可密级（主体属性）， 由 TenantContextFilter 与租户一起从请求头装载。
 *
 * <p>组织/项目可选（缺省 null）；许可密级缺省 INTERNAL。IAM 接入后这些属性从认证 上下文解析，接口形状不变。
 */
public final class PermissionContext {

  public static final String HEADER_ORG = "X-Org-Id";
  public static final String HEADER_PROJECT = "X-Project-Id";
  public static final String HEADER_CLEARANCE = "X-Clearance-Level";

  public static final DataClassification DEFAULT_CLEARANCE = DataClassification.INTERNAL;

  private static final ThreadLocal<String> ORG = new ThreadLocal<>();
  private static final ThreadLocal<String> PROJECT = new ThreadLocal<>();
  private static final ThreadLocal<DataClassification> CLEARANCE = new ThreadLocal<>();

  private PermissionContext() {}

  /** 当前组织标识（请求未携带时为 null）。 */
  public static String org() {
    return ORG.get();
  }

  /** 当前项目标识（请求未携带时为 null）。 */
  public static String project() {
    return PROJECT.get();
  }

  /** 当前主体许可密级（缺省 INTERNAL）。 */
  public static DataClassification clearance() {
    DataClassification level = CLEARANCE.get();
    return level == null ? DEFAULT_CLEARANCE : level;
  }

  public static void set(String org, String project, DataClassification clearance) {
    ORG.set(org);
    PROJECT.set(project);
    CLEARANCE.set(clearance);
  }

  public static void clear() {
    ORG.remove();
    PROJECT.remove();
    CLEARANCE.remove();
  }
}
