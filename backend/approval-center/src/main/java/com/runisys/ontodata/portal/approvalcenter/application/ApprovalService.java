package com.runisys.ontodata.portal.approvalcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.approvalcenter.api.CreateApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.api.DecideApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.infrastructure.ApprovalRequestRepository;
import com.runisys.ontodata.portal.common.PortalIdentityService;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 审批中心服务：审批流骨架（apr-* 审批单）。
 *
 * <p>不变量：PENDING → APPROVED/REJECTED 单向状态机；终态防重（重复审批 409）。 审批不替代业务软件确认链路：MCP 网关 R4
 * 工具把确认卡升级为审批单后，网关按 code 回查审批结果；决策结果由网关轮询拉取（本骨架不向业务软件推送）。
 */
@Service
public class ApprovalService {

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("status", "status");
    fields.put("code", "code");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final ApprovalRequestRepository approvalRepository;
  private final PortalIdentityService identityService;
  private final ObjectMapper objectMapper;

  public ApprovalService(
      ApprovalRequestRepository approvalRepository,
      PortalIdentityService identityService,
      ObjectMapper objectMapper) {
    this.approvalRepository = approvalRepository;
    this.identityService = identityService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public ApprovalRequestResponse create(CreateApprovalRequest request) {
    ApprovalRequest created =
        approvalRepository.saveAndFlush(
            new ApprovalRequest(
                identityService.nextCode("apr"),
                request.getApprovalType().trim(),
                request.getSourceSystem().trim(),
                trimToNull(request.getSourceCode()),
                request.getTitle().trim(),
                toJson(request.getDetail()),
                request.getRequester().trim(),
                Instant.now()));
    return ApprovalRequestResponse.from(created);
  }

  @Transactional
  public ApprovalRequestResponse decide(String code, DecideApprovalRequest request) {
    ApprovalRequest approval = require(code);
    if (!ApprovalRequest.STATUS_PENDING.equals(approval.getStatus())) {
      throw new ResourceStateConflictException("审批单已处于终态：" + approval.getStatus() + "，不允许重复审批");
    }
    approval.decide(
        request.getDecision(),
        request.getDecisionBy().trim(),
        trimToNull(request.getDecisionNote()),
        Instant.now());
    return ApprovalRequestResponse.from(approval);
  }

  @Transactional(readOnly = true)
  public ApprovalRequestResponse find(String code) {
    return ApprovalRequestResponse.from(require(code));
  }

  @Transactional(readOnly = true)
  public PageResponse<ApprovalRequestResponse> list(PageRequestParameters parameters) {
    List<Specification<ApprovalRequest>> predicates = new ArrayList<>();
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getType() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("approvalType"), parameters.getType()));
    }
    Specification<ApprovalRequest> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<ApprovalRequest> page =
        approvalRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, ApprovalRequestResponse::from);
  }

  private ApprovalRequest require(String code) {
    return approvalRepository
        .findByCode(code)
        .orElseThrow(() -> new ResourceNotFoundException("审批单不存在：" + code));
  }

  private String toJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("审批明细序列化失败", impossible);
    }
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
