package com.runisys.ontodata.portal.common.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * 当前操作主体（门户产品化）：写路径与个人中心一律取这里的名字，禁止调用方指定他人身份。
 *
 * <p>安全模式取 JWT {@code sub}；开发模式（无认证）固定 {@code dev-user}。请求体若仍携带 requester /
 * decisionBy，必须与当前主体一致，否则拒绝。
 */
public final class CurrentOperator {

  public static final String DEV_USER = "dev-user";

  public static final String CLAIM_ROLES = "portal_roles";

  private CurrentOperator() {}

  /** 当前主体名；无认证时返回 {@link #DEV_USER}。 */
  public static String name() {
    String authenticated = OperatorContext.authenticatedName();
    return authenticated != null ? authenticated : DEV_USER;
  }

  /**
   * 请求体带了操作者字段时必须与当前主体一致；空白视为未提供。
   *
   * @throws IllegalArgumentException 与当前身份不一致
   */
  public static void requireMatches(String provided) {
    if (provided == null || provided.isBlank()) {
      return;
    }
    String current = name();
    if (!current.equals(provided.trim())) {
      throw new IllegalArgumentException("请求中的操作者与当前登录身份不一致");
    }
  }

  /** JWT {@code portal_roles} 字符串列表；无令牌或无该 claim 时为空。 */
  public static List<String> roles() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
      return List.of();
    }
    Object raw = jwt.getClaim(CLAIM_ROLES);
    if (raw instanceof Collection<?> collection) {
      List<String> roles = new ArrayList<>();
      for (Object item : collection) {
        if (item != null && !item.toString().isBlank()) {
          roles.add(item.toString().trim());
        }
      }
      return Collections.unmodifiableList(roles);
    }
    if (raw instanceof String text && !text.isBlank()) {
      return List.of(text.trim());
    }
    return List.of();
  }
}
