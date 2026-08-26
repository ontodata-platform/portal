package com.runisys.ontodata.portal.common.security.policy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ABAC 策略装配：内置默认策略与「策略行 → 编译快照」编译器。
 *
 * <p>规则类型（strategy 常量与 portal_abac_policy.rule_type 对应）：
 *
 * <ul>
 *   <li>{@code TENANT_MATCH}：主体租户必须等于资源租户；资源无租户=平台级共享，由
 *       {@code params_json.allowNullResourceTenant}（默认 true）决定是否放行；
 *   <li>{@code CLEARANCE_AT_LEAST}：主体许可密级 ≥ 资源密级。
 * </ul>
 *
 * <p>未知规则类型或参数解析失败按<strong>拒绝</strong>编译（fail-closed），并输出告警——
 * 与平台半配置 fail-closed 原则一致，策略行录入错误必须在第一时间暴露。
 */
public final class AbacPolicies {

  public static final String TYPE_TENANT_MATCH = "TENANT_MATCH";
  public static final String TYPE_CLEARANCE_AT_LEAST = "CLEARANCE_AT_LEAST";

  private static final Logger log = LoggerFactory.getLogger(AbacPolicies.class);

  private AbacPolicies() {}

  /** 内置默认策略：与 M5 首版硬编码行为逐条一致，也是空表/加载失败时的兜底。 */
  public static AbacPolicySnapshot builtInDefaults() {
    List<AbacPolicySnapshot.AccessDecision> rules = new ArrayList<>();
    rules.add(tenantMatch(true));
    rules.add(clearanceAtLeast());
    return new AbacPolicySnapshot(List.copyOf(rules));
  }

  /** 把策略行编译为快照：仅取启用行、按 priority 升序；未知类型/坏参数编译为拒绝。 */
  public static AbacPolicySnapshot compile(List<AbacPolicyRule> rows, ObjectMapper objectMapper) {
    List<AbacPolicyRule> enabled =
        rows.stream()
            .filter(AbacPolicyRule::isEnabled)
            .sorted(Comparator.comparingInt(AbacPolicyRule::getPriority))
            .toList();
    List<AbacPolicySnapshot.AccessDecision> decisions = new ArrayList<>();
    for (AbacPolicyRule row : enabled) {
      switch (row.getRuleType()) {
        case TYPE_TENANT_MATCH -> decisions.add(tenantMatch(readAllowNullResourceTenant(row, objectMapper)));
        case TYPE_CLEARANCE_AT_LEAST -> decisions.add(clearanceAtLeast());
        default -> {
          log.warn("ABAC 策略行 {} 类型未知（{}），按拒绝编译（fail-closed）", row.getId(), row.getRuleType());
          decisions.add(denyAll());
        }
      }
    }
    if (decisions.isEmpty()) {
      throw new IllegalStateException("ABAC 策略快照不允许为空（空规则=全放行），应回退内置默认策略");
    }
    return new AbacPolicySnapshot(List.copyOf(decisions));
  }

  private static AbacPolicySnapshot.AccessDecision tenantMatch(boolean allowNullResourceTenant) {
    return (subjectTenant, subjectClearance, resourceTenant, resourceClassification) ->
        allowNullResourceTenant
            ? resourceTenant == null || resourceTenant.equals(subjectTenant)
            : resourceTenant != null && resourceTenant.equals(subjectTenant);
  }

  private static AbacPolicySnapshot.AccessDecision clearanceAtLeast() {
    return (subjectTenant, subjectClearance, resourceTenant, resourceClassification) ->
        subjectClearance != null && resourceClassification != null
            && subjectClearance.rank() >= resourceClassification.rank();
  }

  private static AbacPolicySnapshot.AccessDecision denyAll() {
    return (subjectTenant, subjectClearance, resourceTenant, resourceClassification) -> false;
  }

  private static boolean readAllowNullResourceTenant(
      AbacPolicyRule row, ObjectMapper objectMapper) {
    String json = row.getParamsJson();
    if (json == null || json.isBlank()) {
      return true;
    }
    try {
      JsonNode node = objectMapper.readTree(json);
      JsonNode flag = node.get("allowNullResourceTenant");
      // 显式 false 才收紧；缺省/非法布尔一律保持宽松默认（参数错误宁可暴露为其他校验问题）
      return flag == null || !flag.isBoolean() || flag.asBoolean();
    } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException e) {
      log.warn("ABAC 策略行 {} params_json 解析失败，TENANT_MATCH 收紧为禁止共享资源", row.getId(), e);
      return false;
    }
  }
}
