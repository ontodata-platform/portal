-- WP-03（EVT-01/EVT-02）：任务中心从"回调式 upsert"升级为"事件驱动的任务投影"。
--
-- 投影语义（收敛文档 §8.1 / ADR-006）：portal_task 不再是权威数据，而是各源系统
-- 任务状态的事件投影——权威状态在源系统，本表可随时清空并从事件流整体重放重建。
--
-- 1) owner_system 更名为 source_system：对齐契约 task/v1 与收敛文档 §8.1 的字段命名
--    （投影携带 sourceSystem/sourceTaskId/eventVersion/lastEventId）。
--    RENAME COLUMN 保留存量数据；先删旧索引再建新索引（ALTER TABLE ... DROP INDEX
--    在 MySQL 与 H2 MODE=MySQL 下语义一致，与 data-platform V9 迁移同一写法）。
-- 2) event_version / last_event_id：记录最近一次已应用事件的聚合版本与事件标识，
--    供消费者做乱序防护（aggregateVersion <= event_version 的事件丢弃）与对账。
-- 3) portal_event_inbox：消费者 Inbox 幂等表（ADR-006 投递语义：生产 Outbox + 消费
--    Inbox，端到端至少一次、业务处理幂等）。主键 (consumer_id, event_id)——同一
--    消费组内同一事件只处理一次；消费组之间互不影响（独立位点）。
ALTER TABLE portal_task DROP INDEX idx_portal_task_owner;
ALTER TABLE portal_task RENAME COLUMN owner_system TO source_system;
ALTER TABLE portal_task ADD INDEX idx_portal_task_source (source_system, status);
ALTER TABLE portal_task ADD COLUMN event_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE portal_task ADD COLUMN last_event_id VARCHAR(128) NULL;

CREATE TABLE portal_event_inbox (
    consumer_id VARCHAR(64) NOT NULL,
    event_id VARCHAR(128) NOT NULL,
    received_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (consumer_id, event_id)
);
