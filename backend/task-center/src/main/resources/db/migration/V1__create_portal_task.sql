-- Task Center：各软件任务聚合副本（总体设计 §12.3）。
-- 任务权威归产生它的软件：门户按 taskId 幂等 upsert（事件订阅联调接入前由回调驱动），
-- 副本可由源系统重建；进度只增不回退（冲突以源软件为准，联调按 expectedVersion 收敛）。
-- M5 多租户：幂等键含租户维度（tenant_id, task_id）复合唯一——同一 taskId 可在不同租户
-- 下独立存在，避免租户间相互阻塞与通过 409 探测其他租户数据存在性。
CREATE TABLE portal_task (
    id VARCHAR(36) NOT NULL,
    task_id VARCHAR(128) NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    owner_system VARCHAR(32) NOT NULL,
    parent_task_id VARCHAR(128) NULL,
    status VARCHAR(32) NOT NULL,
    stage VARCHAR(64) NULL,
    progress INT NOT NULL DEFAULT 0,
    resource_refs_json LONGTEXT NULL,
    result_refs_json LONGTEXT NULL,
    trace_id VARCHAR(128) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_task_task_id UNIQUE (tenant_id, task_id),
    INDEX idx_portal_task_owner (owner_system, status),
    INDEX idx_portal_task_parent (parent_task_id)
);
