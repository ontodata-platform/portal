package com.runisys.ontodata.portal.taskcenter.infrastructure;

import com.runisys.ontodata.portal.taskcenter.domain.PortalEventInbox;
import com.runisys.ontodata.portal.taskcenter.domain.PortalEventInboxId;
import org.springframework.data.jpa.repository.JpaRepository;

/** 消费者 Inbox 仓库（EVT-01）：幂等去重查询与一次性重放组的痕迹清理。 */
public interface PortalEventInboxRepository
    extends JpaRepository<PortalEventInbox, PortalEventInboxId> {

  /** 重放重建结束后清理一次性消费组（portal.task-projection-rebuild-*）的 inbox 痕迹。 */
  long deleteByConsumerId(String consumerId);
}
