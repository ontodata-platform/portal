package com.runisys.ontodata.portal.common.security;

import com.runisys.ontodata.portal.common.security.policy.AbacPolicies;
import com.runisys.ontodata.portal.common.security.policy.AbacPolicySource;
import com.runisys.ontodata.portal.common.security.policy.DatabaseAbacPolicySource;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * ABAC 策略引擎（M5 → S1 收口策略外置）：租户×数据密级属性的访问判定。
 *
 * <p>生效策略来自 {@link AbacPolicySource}（生产装配 {@link DatabaseAbacPolicySource}：
 * portal_abac_policy 表 + TTL 缓存 + 内置默认回退，见 V8 迁移与 seed 行）；基线行为与
 * M5 硬编码版逐条一致：
 *
 * <ol>
 *   <li>租户隔离是前提：资源租户与主体租户不一致直接拒绝（跨租户不可见）；
 *   <li>密级比较：主体许可密级 ≥ 资源密级才允许；
 * </ol>
 *
 * <p>引擎无状态：subject/resource 属性由调用方从 PermissionContext 与资源实体提取传入；
 * 判定委托给当前策略快照的合取裁决。组织/项目维度待资源侧属性补齐后以新增策略行扩展，
 * 不改调用方。
 */
@Component
public class AbacPolicyEngine {

  private final AbacPolicySource policySource;

  /** 生产构造：使用真实策略源（数据库快照）。 */
  public AbacPolicyEngine(AbacPolicySource policySource) {
    this.policySource = policySource;
  }

  /** 便捷构造：直接使用内置默认策略（单测/无数据源环境），与 M5 行为一致。 */
  public AbacPolicyEngine() {
    this(AbacPolicies::builtInDefaults);
  }

  /**
   * 判定主体能否访问指定资源。
   *
   * @param subjectTenant 主体租户（TenantContext.current()）
   * @param subjectClearance 主体许可密级（PermissionContext.clearance()）
   * @param resourceTenant 资源租户
   * @param resourceClassification 资源密级
   */
  public boolean allow(
      String subjectTenant,
      DataClassification subjectClearance,
      String resourceTenant,
      DataClassification resourceClassification) {
    return policySource
        .snapshot()
        .allow(subjectTenant, subjectClearance, resourceTenant, resourceClassification);
  }

  /** 主体可见的密级集合（列表过滤用）：许可密级及以下的全部等级， 列表只返回可见行，不泄露高密级数据的存在性。 */
  public List<DataClassification> accessibleLevels(DataClassification subjectClearance) {
    List<DataClassification> levels = new ArrayList<>();
    for (DataClassification level : DataClassification.values()) {
      if (level.rank() <= subjectClearance.rank()) {
        levels.add(level);
      }
    }
    return levels;
  }
}
