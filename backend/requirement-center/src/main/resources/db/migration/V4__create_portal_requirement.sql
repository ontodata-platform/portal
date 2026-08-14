-- Requirement Center：需求管理（总体设计 §5 需求管理）。
-- 需求单归门户（门户业务对象）：接收、去重、分析、分派、计划与关闭；
-- 分派后目标软件以其任务为权威，assignee_ref 仅引用不复制。
-- 状态机：OPEN → ANALYZING → ASSIGNED → IN_PROGRESS → COMPLETED；OPEN/ANALYZING 可 CANCELED；
-- 终态防重由服务层保证；去重查询依赖 normalized_title + requirement_type。
CREATE TABLE portal_requirement (
    id VARCHAR(36) NOT NULL,
    code VARCHAR(40) NOT NULL,
    requirement_type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    normalized_title VARCHAR(200) NOT NULL,
    description LONGTEXT NULL,
    requester VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    assignee_system VARCHAR(32) NULL,
    assignee_ref VARCHAR(128) NULL,
    plan_json LONGTEXT NULL,
    closed_note VARCHAR(500) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_requirement_code UNIQUE (code),
    INDEX idx_portal_requirement_dedupe (requirement_type, normalized_title, status),
    INDEX idx_portal_requirement_status (status, updated_at)
);
