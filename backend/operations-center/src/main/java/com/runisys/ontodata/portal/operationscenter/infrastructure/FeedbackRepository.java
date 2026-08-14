package com.runisys.ontodata.portal.operationscenter.infrastructure;

import com.runisys.ontodata.portal.operationscenter.domain.Feedback;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 反馈仓库。 */
public interface FeedbackRepository
    extends JpaRepository<Feedback, String>, JpaSpecificationExecutor<Feedback> {

  Optional<Feedback> findByCode(String code);

  long countByStatus(String status);
}
