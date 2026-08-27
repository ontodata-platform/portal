package com.runisys.ontodata.portal.approvalcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.approvalcenter.api.BatchDecideFailure;
import com.runisys.ontodata.portal.approvalcenter.api.BatchDecideRequest;
import com.runisys.ontodata.portal.approvalcenter.api.BatchDecideResponse;
import com.runisys.ontodata.portal.approvalcenter.api.CreateApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.api.DecideApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.infrastructure.ApprovalRequestRepository;
import com.runisys.ontodata.portal.common.PortalIdentityService;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.common.event.OutboxEventService;
import com.runisys.ontodata.portal.common.security.CurrentOperator;
import com.runisys.ontodata.portal.common.security.OperatorContext;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 审批中心服务：审批流骨架（apr-* 审批单）。
 *
 * <p>不变量：PENDING → APPROVED/REJECTED 单向状态机；终态防重（重复审批 409）。 审批不替代业务软件确认链路：MCP 网关 R4
 * 工具把确认卡升级为审批单后，WP-07 起决策落定同事务发布版本化事件 portal.approval.decided （Outbox，主题
 * ontodata.portal.approval.v1），网关订阅事件替代轮询回查；GET 查询端点保留为过渡兼容路径， 事件链路稳定后下线。
 */
@Service
public class ApprovalService {

  /** 审批决定事件类型（契约 integration/event-types/portal-approval-decided.schema.json）。 */
  public static final String EVENT_APPROVAL_DECIDED = "portal.approval.decided";

  /** 决策落定是审批单生命周期的第一个事件版本（PENDING→终态单向状态机，聚合版本从 1 起单调递增）。 */
  private static final String AGGREGATE_VERSION_DECIDED = "1";

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
  private final OutboxEventService outboxEventService;
  private final ApplicationEventPublisher applicationEventPublisher;

  public ApprovalService(
      ApprovalRequestRepository approvalRepository,
      PortalIdentityService identityService,
      ObjectMapper objectMapper,
      OutboxEventService outboxEventService,
      ApplicationEventPublisher applicationEventPublisher) {
    this.approvalRepository = approvalRepository;
    this.identityService = identityService;
    this.objectMapper = objectMapper;
    this.outboxEventService = outboxEventService;
    this.applicationEventPublisher = applicationEventPublisher;
  }

  @Transactional
  public ApprovalRequestResponse create(CreateApprovalRequest request) {
    CurrentOperator.requireMatches(request.getRequester());
    ApprovalRequest created =
        new ApprovalRequest(
            identityService.nextCode("apr"),
            request.getApprovalType().trim(),
            request.getSourceSystem().trim(),
            trimToNull(request.getSourceCode()),
            request.getTitle().trim(),
            toJson(request.getDetail()),
            CurrentOperator.name(),
            TenantContext.current(),
            Instant.now());
    created.assignSlaDeadline(request.getSlaDeadline());
    created = approvalRepository.saveAndFlush(created);
    return ApprovalRequestResponse.from(created);
  }

  @Transactional
  public ApprovalRequestResponse decide(String code, DecideApprovalRequest request) {
    CurrentOperator.requireMatches(request.getDecisionBy());
    ApprovalRequest approval = require(code);
    if (!ApprovalRequest.STATUS_PENDING.equals(approval.getStatus())) {
      throw new ResourceStateConflictException("审批单已处于终态：" + approval.getStatus() + "，不允许重复审批");
    }
    approval.decide(
        request.getDecision(),
        CurrentOperator.name(),
        trimToNull(request.getDecisionNote()),
        Instant.now());
    // WP-07：决策落定同事务发布 portal.approval.decided（Outbox）；终态防重在上方，
    // 重复决策抛 409 回滚，不会重复发事件。
    recordApprovalDecidedEvent(approval);
    applicationEventPublisher.publishEvent(
        new ApprovalDecidedApplicationEvent(
            approval.getCode(),
            approval.getApprovalType(),
            approval.getStatus(),
            approval.getRequester(),
            approval.getTitle(),
            approval.getTenantId()));
    return ApprovalRequestResponse.from(approval);
  }

  @Transactional
  public BatchDecideResponse batchDecide(BatchDecideRequest request) {
    CurrentOperator.requireMatches(request.getDecisionBy());
    java.util.ArrayList<ApprovalRequestResponse> succeeded = new java.util.ArrayList<>();
    java.util.ArrayList<BatchDecideFailure> failed = new java.util.ArrayList<>();
    DecideApprovalRequest single = new DecideApprovalRequest();
    single.setDecision(request.getDecision());
    single.setDecisionBy(request.getDecisionBy());
    single.setDecisionNote(request.getDecisionNote());
    for (String code : request.getCodes()) {
      try {
        succeeded.add(decide(code, single));
      } catch (ResourceNotFoundException | ResourceStateConflictException ex) {
        failed.add(new BatchDecideFailure(code, ex.getMessage()));
      }
    }
    return new BatchDecideResponse(request.getDecision(), succeeded, failed);
  }

  /** 投递回写审批明细（不改变终态）。 */
  @Transactional
  public ApprovalRequestResponse replaceDetail(String code, Map<String, Object> detail) {
    ApprovalRequest approval = require(code);
    approval.replaceDetailJson(toJson(detail));
    return ApprovalRequestResponse.from(approval);
  }

  /**
   * 审批决定事件（契约 portal-approval-decided.schema.json，主题 ontodata.portal.approval.v1）： 信封
   * aggregateType=ApprovalRequest、aggregateId=approvalCode、aggregateVersion=1（决策落定，单向状态机首个版本）；
   * 载荷只放决定结果与源系统回查引用，不放审批明细原文。
   */
  private void recordApprovalDecidedEvent(ApprovalRequest approval) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("approvalCode", approval.getCode());
    payload.put("approvalType", approval.getApprovalType());
    payload.put("sourceSystem", approval.getSourceSystem());
    // sourceCode 契约必填：源系统升级来的审批单（如 mcp-gateway 的 cfm-*）必带；
    // 门户原生审批单无源对象时缺省该字段（无回查订阅方）。
    if (approval.getSourceCode() != null) {
      payload.put("sourceCode", approval.getSourceCode());
    }
    payload.put("decision", approval.getStatus());
    // decidedBy 取当前认证主体（安全模式 JWT subject）；无认证上下文（开发模式/系统调用）
    // 按仓库现有约定兜底为审批请求登记的审批人（DecideApprovalRequest.decisionBy）。
    String authenticatedName = OperatorContext.authenticatedName();
    payload.put(
        "decidedBy", authenticatedName != null ? authenticatedName : approval.getDecisionBy());
    payload.put("decidedAt", DateTimeFormatter.ISO_INSTANT.format(approval.getDecisionAt()));
    if (approval.getDecisionNote() != null) {
      payload.put("decisionNote", approval.getDecisionNote());
    }
    outboxEventService.record(
        EVENT_APPROVAL_DECIDED,
        "ApprovalRequest",
        approval.getCode(),
        AGGREGATE_VERSION_DECIDED,
        payload);
  }

  @Transactional(readOnly = true)
  public ApprovalRequestResponse find(String code) {
    return ApprovalRequestResponse.from(require(code));
  }

  @Transactional(readOnly = true)
  public PageResponse<ApprovalRequestResponse> list(PageRequestParameters parameters) {
    List<Specification<ApprovalRequest>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
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
        .findByCodeAndTenantId(code, TenantContext.current())
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
