-- F3a-2：通知中心（事件驱动收件箱）+ 审批 SLA 截止时间。
-- 通知按 (tenant, type, resource_ref, recipient) 去重，避免审批/任务事件重放双写。
-- recipient='*' 表示租户内可见（执行完成无明确提交人时的最小可用口径）。
CREATE TABLE portal_notification (
    id VARCHAR(36) NOT NULL,
    recipient VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body VARCHAR(500) NULL,
    resource_ref VARCHAR(128) NOT NULL,
    read_at TIMESTAMP(6) NULL,
    tenant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portal_notification_dedup UNIQUE (tenant_id, type, resource_ref, recipient),
    INDEX idx_portal_notification_inbox (tenant_id, recipient, created_at)
);

ALTER TABLE portal_approval_request
    ADD COLUMN sla_deadline TIMESTAMP(6) NULL;
