package com.runisys.ontodata.portal.taskcenter.infrastructure;

import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 任务聚合副本仓库。 */
public interface PortalTaskRepository
    extends JpaRepository<PortalTask, String>, JpaSpecificationExecutor<PortalTask> {

  Optional<PortalTask> findByTaskId(String taskId);

  /** 数据保留（M5）：只统计超过保留期的终态任务（非终态永不清理）。 */
  @Query("select count(t) from PortalTask t where t.status in :statuses and t.createdAt < :cutoff")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);

  /** 数据保留（M5）：删除超过保留期的终态任务（非终态永不清理）。 */
  @Modifying
  @Query("delete from PortalTask t where t.status in :statuses and t.createdAt < :cutoff")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);
}
