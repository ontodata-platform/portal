package com.runisys.ontodata.portal.operationscenter.infrastructure;

import com.runisys.ontodata.portal.operationscenter.domain.Notice;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 公告仓库。 */
public interface NoticeRepository
    extends JpaRepository<Notice, String>, JpaSpecificationExecutor<Notice> {

  Optional<Notice> findByCode(String code);

  long countByStatus(String status);
}
