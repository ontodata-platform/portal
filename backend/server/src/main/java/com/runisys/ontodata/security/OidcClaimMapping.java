package com.runisys.ontodata.security;

import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * OIDC 身份 claim → 平台请求级上下文（租户/组织/项目/许可密级）的纯映射（M5 IAM）。
 *
 * <p>claim 约定（与 IdP 侧声明协议一致）：
 *
 * <ul>
 *   <li>{@code tenant_id}：租户（必填，格式 [a-z0-9-]{1,64}）——缺失或非法视为不可信身份；
 *   <li>{@code org_id} / {@code project_id}：组织/项目（可选，非法值按未提供处理）；
 *   <li>{@code clearance}：许可密级（可选，缺省 INTERNAL；非法值按缺省处理——失败安全， 宁可少授权不误授权）。
 * </ul>
 *
 * <p>本骨架只支持 resource-server 流程的 Jwt 主体；浏览器登录（authorization code）流程的 OidcUser 主体在 IAM
 * 后续轮次接入（映射函数形状不变）。
 */
public final class OidcClaimMapping {

  public static final String CLAIM_TENANT = "tenant_id";
  public static final String CLAIM_ORG = "org_id";
  public static final String CLAIM_PROJECT = "project_id";
  public static final String CLAIM_CLEARANCE = "clearance";

  private static final Pattern IDENTIFIER_PATTERN = Pattern.compile("^[a-z0-9\\-]{1,64}$");

  private OidcClaimMapping() {}

  /** 认证上下文映射出的身份属性（租户不可缺省）。 */
  public record IdentityClaims(
      String tenantId, String orgId, String projectId, DataClassification clearance) {}

  /** 从认证信息提取身份属性；不可信（未认证/缺租户 claim/租户非法）返回 null， 由调用方按 403 拒绝。 */
  public static IdentityClaims from(Authentication authentication) {
    if (authentication == null || !authentication.isAuthenticated()) {
      return null;
    }
    Map<String, Object> attributes = attributesOf(authentication.getPrincipal());
    if (attributes == null) {
      return null;
    }
    String tenantId = trimToNull(asString(attributes.get(CLAIM_TENANT)));
    if (tenantId == null || !IDENTIFIER_PATTERN.matcher(tenantId).matches()) {
      return null;
    }
    return new IdentityClaims(
        tenantId,
        normalizeIdentifier(attributes.get(CLAIM_ORG)),
        normalizeIdentifier(attributes.get(CLAIM_PROJECT)),
        clearanceOf(attributes.get(CLAIM_CLEARANCE)));
  }

  private static Map<String, Object> attributesOf(Object principal) {
    if (principal instanceof Jwt jwt) {
      return jwt.getClaims();
    }
    // OidcUser（浏览器登录流程）主体 IAM 后续轮次接入
    return null;
  }

  /** 许可密级：缺省 INTERNAL；非法值按缺省处理（失败安全，不因 claim 异常放权）。 */
  private static DataClassification clearanceOf(Object value) {
    String text = trimToNull(asString(value));
    if (text == null) {
      return PermissionContext.DEFAULT_CLEARANCE;
    }
    try {
      return DataClassification.fromString(text);
    } catch (IllegalArgumentException invalid) {
      return PermissionContext.DEFAULT_CLEARANCE;
    }
  }

  /** 组织/项目：非法值按未提供（null）处理，不阻断请求（可选属性容错）。 */
  private static String normalizeIdentifier(Object value) {
    String text = trimToNull(asString(value));
    return text != null && IDENTIFIER_PATTERN.matcher(text).matches() ? text : null;
  }

  private static String asString(Object value) {
    return value instanceof String text ? text : null;
  }

  private static String trimToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
