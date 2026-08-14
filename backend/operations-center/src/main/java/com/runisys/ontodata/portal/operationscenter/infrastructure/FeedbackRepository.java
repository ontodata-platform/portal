package com.runisys.ontodata.portal.operationscenter.infrastructure;

import com.runisys.ontodata.portal.operationscenter.domain.Feedback;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 反馈仓库。 */
public interface FeedbackRepository
    extends JpaRepository<Feedback, String>, JpaSpecificationExecutor<Feedback> {

  Optional<Feedback> findByCodeAndTenantId(String code, String tenantId);

  long countByStatusAndTenantId(String status, String tenantId);

  /** 数据保留（M5，租户隔离）：只统计本租户超过保留期的已处理反馈。 */
  @Query(
      "select count(f) from Feedback f where f.status in :statuses"
          + " and f.createdAt < :cutoff and f.tenantId = :tenantId")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);

  /** 数据保留（M5，租户隔离）：删除本租户超过保留期的已处理反馈。 */
  @Modifying
  @Query(
      "delete from Feedback f where f.status in :statuses"
          + " and f.createdAt < :cutoff and f.tenantId = :tenantId")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);
}
