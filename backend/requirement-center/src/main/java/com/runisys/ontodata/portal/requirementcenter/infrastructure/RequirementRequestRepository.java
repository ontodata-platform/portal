package com.runisys.ontodata.portal.requirementcenter.infrastructure;

import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 需求单仓库。 */
public interface RequirementRequestRepository
    extends JpaRepository<RequirementRequest, String>,
        JpaSpecificationExecutor<RequirementRequest> {

  Optional<RequirementRequest> findByCodeAndTenantId(String code, String tenantId);

  /** 去重：同类型同归一化标题、同租户内未到终态的需求单视为重复（M5 租户隔离）。 */
  Optional<RequirementRequest>
      findFirstByRequirementTypeAndNormalizedTitleAndTenantIdAndStatusNotIn(
          String requirementType,
          String normalizedTitle,
          String tenantId,
          Collection<String> terminalStatuses);

  /** 数据保留（M5，租户隔离）：只统计本租户超过保留期的终态需求。 */
  @Query(
      "select count(r) from RequirementRequest r where r.status in :statuses"
          + " and r.createdAt < :cutoff and r.tenantId = :tenantId")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);

  /** 数据保留（M5，租户隔离）：删除本租户超过保留期的终态需求。 */
  @Modifying
  @Query(
      "delete from RequirementRequest r where r.status in :statuses"
          + " and r.createdAt < :cutoff and r.tenantId = :tenantId")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses,
      @Param("cutoff") Instant cutoff,
      @Param("tenantId") String tenantId);
}
