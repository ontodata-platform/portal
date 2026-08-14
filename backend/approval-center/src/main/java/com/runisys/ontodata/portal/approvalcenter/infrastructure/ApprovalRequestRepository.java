package com.runisys.ontodata.portal.approvalcenter.infrastructure;

import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 审批单仓库。 */
public interface ApprovalRequestRepository
    extends JpaRepository<ApprovalRequest, String>, JpaSpecificationExecutor<ApprovalRequest> {

  Optional<ApprovalRequest> findByCode(String code);
}
