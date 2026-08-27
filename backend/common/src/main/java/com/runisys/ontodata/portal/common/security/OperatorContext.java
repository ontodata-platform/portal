package com.runisys.ontodata.portal.common.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 操作主体上下文（WP-07）：事件载荷审计字段（decidedBy 等）的取值来源， 与 algorithm-transform 的 OperatorContext 同构。
 *
 * <p>安全模式（OIDC Bearer JWT）取认证主体名（JWT subject）；开发模式或无请求上下文的场景 （未认证调用、单元测试）返回 null。业务写入请用 {@link CurrentOperator#name()}（开发模式回退
 * {@code dev-user}），不要再让调用方传入 requester。
 */
public final class OperatorContext {

  private OperatorContext() {}

  /** 当前认证主体名；无认证上下文时返回 null。 */
  public static String authenticatedName() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null
        && authentication.isAuthenticated()
        && !(authentication instanceof AnonymousAuthenticationToken)) {
      String name = authentication.getName();
      if (name != null && !name.isBlank()) {
        return name.trim();
      }
    }
    return null;
  }
}
