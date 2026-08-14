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

  Optional<RequirementRequest> findByCode(String code);

  /** 去重：同类型同归一化标题、且未到终态的需求单视为重复。 */
  Optional<RequirementRequest> findFirstByRequirementTypeAndNormalizedTitleAndStatusNotIn(
      String requirementType, String normalizedTitle, Collection<String> terminalStatuses);

  /** 数据保留（M5）：只统计超过保留期的终态需求。 */
  @Query(
      "select count(r) from RequirementRequest r where r.status in :statuses and r.createdAt < :cutoff")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);

  /** 数据保留（M5）：删除超过保留期的终态需求。 */
  @Modifying
  @Query("delete from RequirementRequest r where r.status in :statuses and r.createdAt < :cutoff")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);
}
