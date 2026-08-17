package com.runisys.ontodata.portal.taskcenter.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * 消费者 Inbox 幂等表（EVT-01 / ADR-006 投递语义：生产 Outbox + 消费 Inbox，端到端至少一次、 业务处理幂等）。
 *
 * <p>主键 (consumer_id, event_id)：同一消费组内同一事件只处理一次；不同消费组（如正常消费组 {@code portal.task-projection} 与一次性重放组
 * {@code portal.task-projection-rebuild-*}）互不影响， 各自维护独立去重视图——这也是投影可由独立消费组整体重放重建的基础。
 *
 * <p>消费处理器在<b>同一事务</b>内"插 inbox + 更新投影"：inbox 主键冲突即代表事件已处理过， 事务回滚后由 Spring Kafka 重试驱动再次消费，此时按 inbox
 * 命中直接跳过。
 */
@Entity
@Table(name = "portal_event_inbox")
@IdClass(PortalEventInboxId.class)
public class PortalEventInbox {

  /** 消费组标识（consumer_id），隔离不同消费者的去重空间。 */
  @Id
  @Column(name = "consumer_id", nullable = false, length = 64)
  private String consumerId;

  /** 事件全局唯一标识（信封 eventId）。 */
  @Id
  @Column(name = "event_id", nullable = false, length = 128)
  private String eventId;

  @Column(name = "received_at", nullable = false)
  private Instant receivedAt;

  protected PortalEventInbox() {}

  public PortalEventInbox(String consumerId, String eventId, Instant receivedAt) {
    this.consumerId = consumerId;
    this.eventId = eventId;
    this.receivedAt = receivedAt;
  }

  public String getConsumerId() {
    return consumerId;
  }

  public String getEventId() {
    return eventId;
  }

  public Instant getReceivedAt() {
    return receivedAt;
  }
}
