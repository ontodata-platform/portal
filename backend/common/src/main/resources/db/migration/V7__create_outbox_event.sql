-- WP-07 Outbox 事件表：业务变更与事件同事务落库（对齐契约 integration v1 事件信封与 ADR-006，
-- 与 data-platform V10 同构）。
-- 发布语义（EVT-01）：published_at IS NULL 表示待发布；发布器成功写入 Kafka 后回写 published_at（幂等 ack）。
-- envelope_json 保存完整信封原文，发布器原样转发，不在投递链路二次组装。
CREATE TABLE outbox_event (
    id VARCHAR(36) NOT NULL,
    event_id VARCHAR(40) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    envelope_json LONGTEXT NOT NULL,
    occurred_at TIMESTAMP(6) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_outbox_event_event_id UNIQUE (event_id),
    INDEX idx_outbox_event_unpublished (published_at, occurred_at),
    INDEX idx_outbox_event_tenant (tenant_id)
);
