package com.runisys.ontodata.portal.common.security;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * ABAC 策略引擎（M5）：租户×组织×项目×数据密级 四维属性的访问判定。
 *
 * <p>当前生效策略（M5 首版，代码内策略 + 中文注释，策略外置与策略管理后续落地）：
 *
 * <ol>
 *   <li>租户隔离是前提：资源租户与主体租户不一致直接拒绝（跨租户不可见）；
 *   <li>密级比较：主体许可密级 ≥ 资源密级才允许；
 *   <li>组织/项目维度：资源侧尚未携带组织/项目属性（数据目录与任务组织属性后续接入）， 引擎形状已按四维设计，资源属性补齐后策略直接扩展，不改调用方。
 * </ol>
 *
 * <p>引擎为无状态纯函数：subject/resource 属性由调用方从 PermissionContext 与资源实体 提取传入，便于单元测试与策略演进。
 */
@Component
public class AbacPolicyEngine {

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
    if (resourceTenant != null && !resourceTenant.equals(subjectTenant)) {
      return false;
    }
    return subjectClearance.rank() >= resourceClassification.rank();
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
