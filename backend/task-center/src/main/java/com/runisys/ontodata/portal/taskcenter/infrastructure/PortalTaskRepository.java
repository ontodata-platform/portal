package com.runisys.ontodata.portal.taskcenter.infrastructure;

import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 任务聚合副本仓库。 */
public interface PortalTaskRepository
    extends JpaRepository<PortalTask, String>, JpaSpecificationExecutor<PortalTask> {

  Optional<PortalTask> findByTaskId(String taskId);
}
