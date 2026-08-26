package com.runisys.ontodata.portal.common.security.policy;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** ABAC 策略行仓储：只读消费为主（策略管理面后续 WP 落地）。 */
public interface AbacPolicyRuleRepository extends JpaRepository<AbacPolicyRule, Long> {

  /** 启用中的策略行，按优先级升序（合取裁决顺序）。 */
  List<AbacPolicyRule> findByEnabledTrueOrderByPriorityAsc();
}
