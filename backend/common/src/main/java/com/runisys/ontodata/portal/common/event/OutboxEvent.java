package com.runisys.ontodata.portal.common.event;

import com.runisys.ontodata.portal.common.TenantContext;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Outbox 事件（契约 integration v1 事件信封）：与业务变更同事务落库（WP-07，与 data-platform WP-03 同构）。
 *
 * <p>不变量：事件只表达对象发生了什么——eventId 供消费者去重，aggregateVersion 防旧事件覆盖新状态； envelopeJson 为完整信封 JSON（含
 * schemaVersion/producer/occurredAt/payload），发布器原样转发； 发布成功后回写 publishedAt（ack 幂等），at-least-once
 * 投递的去重责任在消费者（按 eventId）。
 */
@Entity
@Table(name = "outbox_event")
public class OutboxEvent {

  @Id
  @Column(length = 36, nullable = false, updatable = false)
  private String id;

  @Column(name = "event_id", nullable = false, updatable = false, length = 40, unique = true)
  private String eventId;

  @Column(name = "event_type", nullable = false, updatable = false, length = 64)
  private String eventType;

  /** 目标主题（ADR-006 命名），record 时按事件类型登记映射固化，避免投递时再推断。 */
  @Column(name = "topic", nullable = false, updatable = false, length = 128)
  private String topic;

  @Column(name = "aggregate_id", nullable = false, updatable = false, length = 128)
  private String aggregateId;

  @Column(
      name = "envelope_json",
      nullable = false,
      updatable = false,
      columnDefinition = "longtext")
  private String envelopeJson;

  @Column(name = "occurred_at", nullable = false, updatable = false)
  private Instant occurredAt;

  @Column(name = "published_at")
  private Instant publishedAt;

  @Column(name = "tenant_id", nullable = false, length = 64)
  private String tenantId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected OutboxEvent() {}

  public OutboxEvent(
      String eventId,
      String eventType,
      String topic,
      String aggregateId,
      String envelopeJson,
      Instant occurredAt) {
    this.id = UUID.randomUUID().toString();
    this.eventId = eventId;
    this.eventType = eventType;
    this.topic = topic;
    this.aggregateId = aggregateId;
    this.envelopeJson = envelopeJson;
    this.occurredAt = occurredAt;
    this.tenantId = TenantContext.current();
    this.createdAt = occurredAt;
    this.updatedAt = occurredAt;
  }

  /** ack（幂等）：首次 ack 落 publishedAt 返回 true；重复 ack 无副作用返回 false。 */
  public boolean acknowledge(Instant now) {
    if (publishedAt != null) {
      return false;
    }
    this.publishedAt = now;
    this.updatedAt = now;
    return true;
  }

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
    if (updatedAt == null) {
      updatedAt = createdAt;
    }
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public String getId() {
    return id;
  }

  public String getEventId() {
    return eventId;
  }

  public String getEventType() {
    return eventType;
  }

  public String getTopic() {
    return topic;
  }

  public String getAggregateId() {
    return aggregateId;
  }

  public String getEnvelopeJson() {
    return envelopeJson;
  }

  public Instant getOccurredAt() {
    return occurredAt;
  }

  public Instant getPublishedAt() {
    return publishedAt;
  }

  public String getTenantId() {
    return tenantId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
