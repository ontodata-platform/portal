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

  Optional<PortalTask> findByTaskIdAndTenantId(String taskId, String tenantId);

  /** 数据保留（M5，租户隔离）：只统计本租户超过保留期的终态任务。 */
  @Query(
      "select count(t) from PortalTask t where t.status in :statuses and t.createdAt < :cutoff"
          + " and t.tenantId = :tenantId")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);

  /** 数据保留（M5，租户隔离）：删除本租户超过保留期的终态任务。 */
  @Modifying
  @Query(
      "delete from PortalTask t where t.status in :statuses and t.createdAt < :cutoff"
          + " and t.tenantId = :tenantId")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);
}
