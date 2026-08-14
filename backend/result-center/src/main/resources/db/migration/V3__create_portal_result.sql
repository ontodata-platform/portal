-- Result Center：结果引用登记（总体设计 §13.4 可追踪率 100%）。
-- 结果权威归产生它的软件：门户只存引用与元数据（大对象走对象存储）；
-- 每个结果必须携带来源系统与结果标识，按 (tenant_id, source_system, result_id) 幂等登记——
-- M5 多租户：幂等键含租户维度，同一结果标识可在不同租户下独立登记。
-- M5 ABAC：结果携带数据密级（缺省 PUBLIC），访问按主体许可密级判定。
CREATE TABLE portal_result (
    id VARCHAR(36) NOT NULL,
    result_id VARCHAR(128) NOT NULL,
    source_system VARCHAR(32) NOT NULL,
    result_type VARCHAR(40) NOT NULL,
    resource_refs_json LONGTEXT NULL,
    metadata_json LONGTEXT NULL,
    source_task_id VARCHAR(128) NULL,
    trace_id VARCHAR(128) NULL,
    data_classification VARCHAR(32) NOT NULL DEFAULT 'PUBLIC',
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_result_identity UNIQUE (tenant_id, source_system, result_id),
    INDEX idx_portal_result_type (result_type, updated_at),
    INDEX idx_portal_result_task (source_task_id)
);
