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

  Optional<ApprovalRequest> findByCode(String code);

  /** 数据保留（M5）：只统计超过保留期的终态审批单。 */
  @Query(
      "select count(a) from ApprovalRequest a where a.status in :statuses and a.createdAt < :cutoff")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);

  /** 数据保留（M5）：删除超过保留期的终态审批单。 */
  @Modifying
  @Query("delete from ApprovalRequest a where a.status in :statuses and a.createdAt < :cutoff")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);
}
