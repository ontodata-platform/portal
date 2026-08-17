package com.runisys.ontodata.portal.common.event;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Outbox 事件存取：发布器只关心"未发布 + 按发生时间升序"，保证同分区事件按序投递。 */
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, String> {

  List<OutboxEvent> findByPublishedAtIsNullOrderByOccurredAtAsc(Pageable pageable);

  Optional<OutboxEvent> findByEventId(String eventId);
}
