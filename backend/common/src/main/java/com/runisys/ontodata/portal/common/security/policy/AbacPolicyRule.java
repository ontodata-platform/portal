package com.runisys.ontodata.portal.common.security.policy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * ABAC 策略行（真实策略源，V8 迁移建表）：M5 代码内硬编码规则外置后的持久化形态。
 *
 * <p>裁决语义见 {@link AbacPolicies}：启用行按 priority 升序合取。本表是平台级配置数据，
 * 不是租户数据，不做租户隔离。
 */
@Entity
@Table(name = "portal_abac_policy")
public class AbacPolicyRule {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "rule_type", nullable = false, length = 64)
  private String ruleType;

  @Column(nullable = false)
  private int priority;

  @Column(name = "params_json", columnDefinition = "TEXT")
  private String paramsJson;

  @Column(nullable = false)
  private boolean enabled;

  @Column(length = 255)
  private String remark;

  protected AbacPolicyRule() {}

  public AbacPolicyRule(String ruleType, int priority, String paramsJson, boolean enabled, String remark) {
    this.ruleType = ruleType;
    this.priority = priority;
    this.paramsJson = paramsJson;
    this.enabled = enabled;
    this.remark = remark;
  }

  public Long getId() {
    return id;
  }

  public String getRuleType() {
    return ruleType;
  }

  public int getPriority() {
    return priority;
  }

  public String getParamsJson() {
    return paramsJson;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public String getRemark() {
    return remark;
  }
}
