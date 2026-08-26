-- S1 收口 ABAC 策略外置（ADR-005 执行注记）：真实策略源=数据库，
-- 替换 M5 首版引擎内硬编码规则。本表为平台级配置数据，不做租户隔离。
-- 裁决语义（AbacPolicies）：启用行按 priority 升序合取，全部通过才放行；
-- 未知 rule_type / 坏参数编译为拒绝（fail-closed）；空表或加载失败运行时回退内置默认。
CREATE TABLE portal_abac_policy (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_type VARCHAR(64) NOT NULL,
    priority INT NOT NULL,
    params_json TEXT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    remark VARCHAR(255) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_portal_abac_policy_enabled (enabled, priority)
);

-- 基线种子：两行默认策略与 M5 行为逐条一致（迁移后决策结果不变）
INSERT INTO portal_abac_policy (rule_type, priority, params_json, enabled, remark) VALUES
    ('TENANT_MATCH', 10, '{"allowNullResourceTenant": true}', TRUE,
     '租户隔离前提：资源带租户则主体必须同租户；资源无租户=平台级共享放行（allowNullResourceTenant=false 可收紧为全部要求租户归属）'),
    ('CLEARANCE_AT_LEAST', 20, NULL, TRUE,
     '密级裁决：主体许可密级必须 ≥ 资源密级');
