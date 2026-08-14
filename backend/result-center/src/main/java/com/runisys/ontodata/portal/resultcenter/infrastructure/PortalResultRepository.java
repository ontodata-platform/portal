package com.runisys.ontodata.portal.resultcenter.infrastructure;

import com.runisys.ontodata.portal.resultcenter.domain.PortalResult;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 结果引用登记仓库。 */
public interface PortalResultRepository
    extends JpaRepository<PortalResult, String>, JpaSpecificationExecutor<PortalResult> {

  Optional<PortalResult> findBySourceSystemAndResultId(String sourceSystem, String resultId);
}
