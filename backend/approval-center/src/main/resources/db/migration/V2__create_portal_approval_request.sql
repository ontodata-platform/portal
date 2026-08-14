-- Approval Center：审批流骨架（apr-* 审批单）。
-- 审批不替代业务软件的确认链路：MCP 网关 R4 工具审批与确认卡联动时，把确认卡 code
-- 升级为审批单（source_system=mcp-gateway，source_code=cfm-*），审批结果由网关轮询回查。
-- 状态机：PENDING → APPROVED/REJECTED；终态防重由服务层保证（数据库兜底唯一约束在
-- decision 事件表，当前骨架不设多余约束，避免阻塞重试）。
-- M5 多租户：code 唯一约束为 (tenant_id, code) 复合——审批单编号只在租户内唯一，
-- 跨租户不互相阻塞。
CREATE TABLE portal_approval_request (
    id VARCHAR(36) NOT NULL,
    code VARCHAR(40) NOT NULL,
    approval_type VARCHAR(40) NOT NULL,
    source_system VARCHAR(32) NOT NULL,
    source_code VARCHAR(128) NULL,
    title VARCHAR(200) NOT NULL,
    detail_json LONGTEXT NULL,
    requester VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    decision_by VARCHAR(64) NULL,
    decision_note VARCHAR(500) NULL,
    decision_at TIMESTAMP(6) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_approval_code UNIQUE (tenant_id, code),
    INDEX idx_portal_approval_source (source_system, source_code),
    INDEX idx_portal_approval_status (status, created_at)
);
