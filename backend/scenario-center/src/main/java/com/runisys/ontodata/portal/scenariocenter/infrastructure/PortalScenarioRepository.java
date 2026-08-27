package com.runisys.ontodata.portal.scenariocenter.infrastructure;

import com.runisys.ontodata.portal.scenariocenter.domain.PortalScenario;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 场景仓库：版本链查询与唯一版本定位均限定本租户（M5 租户隔离）。 */
public interface PortalScenarioRepository
    extends JpaRepository<PortalScenario, String>, JpaSpecificationExecutor<PortalScenario> {

  Optional<PortalScenario> findByCodeAndVersionAndTenantId(
      String code, String version, String tenantId);

  /** 版本链（新草稿版本号由服务层在最高版本上递增补丁位）。 */
  List<PortalScenario> findByCodeAndTenantIdOrderByCreatedAtAsc(String code, String tenantId);
}
