package com.runisys.ontodata.portal.taskcenter.domain;

import java.io.Serializable;
import java.util.Objects;

/** {@link PortalEventInbox} 复合主键：(consumer_id, event_id)。 */
public class PortalEventInboxId implements Serializable {

  private String consumerId;
  private String eventId;

  public PortalEventInboxId() {}

  public PortalEventInboxId(String consumerId, String eventId) {
    this.consumerId = consumerId;
    this.eventId = eventId;
  }

  @Override
  public boolean equals(Object other) {
    if (this == other) {
      return true;
    }
    if (!(other instanceof PortalEventInboxId that)) {
      return false;
    }
    return Objects.equals(consumerId, that.consumerId) && Objects.equals(eventId, that.eventId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(consumerId, eventId);
  }
}
