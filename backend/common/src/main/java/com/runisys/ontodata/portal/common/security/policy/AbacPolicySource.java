package com.runisys.ontodata.portal.common.security.policy;

/** ABAC 策略源：提供当前生效的策略快照。实现方负责缓存与失败回退。 */
public interface AbacPolicySource {

  /** 返回当前生效的已编译策略快照；不允许返回 null 或空快照（空规则=全放行，禁止）。 */
  AbacPolicySnapshot snapshot();
}
