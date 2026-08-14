package com.runisys.ontodata.portal.requirementcenter.infrastructure;

import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 需求单仓库。 */
public interface RequirementRequestRepository
    extends JpaRepository<RequirementRequest, String>,
        JpaSpecificationExecutor<RequirementRequest> {

  Optional<RequirementRequest> findByCode(String code);

  /** 去重：同类型同归一化标题、且未到终态的需求单视为重复。 */
  Optional<RequirementRequest> findFirstByRequirementTypeAndNormalizedTitleAndStatusNotIn(
      String requirementType, String normalizedTitle, Collection<String> terminalStatuses);
}
