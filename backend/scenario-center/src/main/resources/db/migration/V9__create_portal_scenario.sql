-- Scenario Center：场景编排器（contracts/scenario/v1，已冻结）。
-- 场景是 L0 闭环一等对象：把已发布本体包、数据快照、能力版本与工作流模板版本装配为
-- 可交付应用；只存引用 + 精确钉扎版本（禁止 latest/通配符），不拥有被引用资产。
-- 不可变版本惯例：(tenant_id, code, version) 复合唯一；PUBLISHED 后该版本对象不可变，
-- 修改产生新草稿版本（服务层递增补丁号）。
-- M5 多租户：列表/详情/流转全部按租户隔离，同一编码可在不同租户独立存在。
CREATE TABLE portal_scenario (
    id VARCHAR(36) NOT NULL,
    code VARCHAR(72) NOT NULL,
    version VARCHAR(16) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(1024) NULL,
    project_id VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL,
    ontology_refs_json LONGTEXT NULL,
    bindings_json LONGTEXT NOT NULL,
    presentation_json LONGTEXT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_by VARCHAR(64) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_scenario_version UNIQUE (tenant_id, code, version),
    INDEX idx_portal_scenario_code (tenant_id, code),
    INDEX idx_portal_scenario_status (tenant_id, status, updated_at)
);
