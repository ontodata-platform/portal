package com.runisys.ontodata.portal.common.security.policy;

import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.List;

/**
 * 已编译 ABAC 策略快照：按优先级排序的启用规则列表（不可变）。
 *
 * <p>裁决语义：合取——全部规则通过才放行；任一规则拒绝即拒绝。与 ADR-005 默认拒绝原则一致。
 */
public final class AbacPolicySnapshot {

  /** 单条规则的判定函数：返回 false 表示该规则拒绝访问。 */
  @FunctionalInterface
  public interface AccessDecision {
    boolean allow(
        String subjectTenant,
        DataClassification subjectClearance,
        String resourceTenant,
        DataClassification resourceClassification);
  }

  private final List<AccessDecision> orderedRules;

  AbacPolicySnapshot(List<AccessDecision> orderedRules) {
    this.orderedRules = orderedRules;
  }

  public boolean allow(
      String subjectTenant,
      DataClassification subjectClearance,
      String resourceTenant,
      DataClassification resourceClassification) {
    for (AccessDecision rule : orderedRules) {
      if (!rule.allow(subjectTenant, subjectClearance, resourceTenant, resourceClassification)) {
        return false;
      }
    }
    return true;
  }
}
