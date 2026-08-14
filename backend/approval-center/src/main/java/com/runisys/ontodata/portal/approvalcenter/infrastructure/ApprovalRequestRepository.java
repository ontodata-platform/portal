package com.runisys.ontodata.portal.approvalcenter.infrastructure;

import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 审批单仓库。 */
public interface ApprovalRequestRepository
    extends JpaRepository<ApprovalRequest, String>, JpaSpecificationExecutor<ApprovalRequest> {

  Optional<ApprovalRequest> findByCodeAndTenantId(String code, String tenantId);

  /** 数据保留（M5，租户隔离）：只统计本租户超过保留期的终态审批单。 */
  @Query(
      "select count(a) from ApprovalRequest a where a.status in :statuses"
          + " and a.createdAt < :cutoff and a.tenantId = :tenantId")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);

  /** 数据保留（M5，租户隔离）：删除本租户超过保留期的终态审批单。 */
  @Modifying
  @Query(
      "delete from ApprovalRequest a where a.status in :statuses"
          + " and a.createdAt < :cutoff and a.tenantId = :tenantId")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);
}
