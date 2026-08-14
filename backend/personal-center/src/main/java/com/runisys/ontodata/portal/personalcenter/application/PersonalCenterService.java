package com.runisys.ontodata.portal.personalcenter.application;

import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.infrastructure.ApprovalRequestRepository;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.personalcenter.api.PersonalTodoResponse;
import com.runisys.ontodata.portal.requirementcenter.api.RequirementRequestResponse;
import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import com.runisys.ontodata.portal.requirementcenter.infrastructure.RequirementRequestRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 个人中心服务（总体设计 §5 个人中心首版）：聚合门户本地对象——我的需求、我的申请与 待办统计；任务/结果无归属人字段，M5 接 IAM 后随身份上下文扩展（权限全景也在 M5）。
 *
 * <p>身份说明：门户尚无统一身份（M5 IAM 对接），requester 由调用方显式传入； IAM 接入后改为从认证上下文读取，接口形状不变。
 */
@Service
public class PersonalCenterService {

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("status", "status");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final RequirementRequestRepository requirementRepository;
  private final ApprovalRequestRepository approvalRepository;

  public PersonalCenterService(
      RequirementRequestRepository requirementRepository,
      ApprovalRequestRepository approvalRepository) {
    this.requirementRepository = requirementRepository;
    this.approvalRepository = approvalRepository;
  }

  /** 我的需求（按提出人过滤，分页与各中心协议同构；M5 租户隔离）。 */
  @Transactional(readOnly = true)
  public PageResponse<RequirementRequestResponse> myRequirements(
      String requester, PageRequestParameters parameters) {
    List<Specification<RequirementRequest>> predicates = new ArrayList<>();
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("requester"), requester.trim()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getType() != null) {
      predicates.add(
          (root, query, builder) ->
              builder.equal(root.get("requirementType"), parameters.getType()));
    }
    Specification<RequirementRequest> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<RequirementRequest> page =
        requirementRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, RequirementRequestResponse::from);
  }

  /** 我的申请（按申请人过滤；M5 租户隔离）。 */
  @Transactional(readOnly = true)
  public PageResponse<ApprovalRequestResponse> myApprovals(
      String requester, PageRequestParameters parameters) {
    List<Specification<ApprovalRequest>> predicates = new ArrayList<>();
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("requester"), requester.trim()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    Specification<ApprovalRequest> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<ApprovalRequest> page =
        approvalRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, ApprovalRequestResponse::from);
  }

  /** 待办统计：待审批（全体 PENDING，IAM 后按审批人过滤）、我的进行中需求、我的需求/申请总数（M5 租户隔离）。 */
  @Transactional(readOnly = true)
  public PersonalTodoResponse todos(String requester) {
    String normalized = requester.trim();
    String tenantId = TenantContext.current();
    long pendingApprovals =
        approvalRepository.count(
            (root, query, builder) ->
                builder.and(
                    builder.equal(root.get("tenantId"), tenantId),
                    builder.equal(root.get("status"), ApprovalRequest.STATUS_PENDING)));
    long myOpenRequirements =
        requirementRepository.count(
            (root, query, builder) ->
                builder.and(
                    builder.equal(root.get("tenantId"), tenantId),
                    builder.equal(root.get("requester"), normalized),
                    builder.or(
                        builder.equal(root.get("status"), RequirementRequest.STATUS_OPEN),
                        builder.equal(root.get("status"), RequirementRequest.STATUS_ANALYZING))));
    long myRequirements =
        requirementRepository.count(
            (root, query, builder) ->
                builder.and(
                    builder.equal(root.get("tenantId"), tenantId),
                    builder.equal(root.get("requester"), normalized)));
    long myApprovals =
        approvalRepository.count(
            (root, query, builder) ->
                builder.and(
                    builder.equal(root.get("tenantId"), tenantId),
                    builder.equal(root.get("requester"), normalized)));
    return new PersonalTodoResponse(
        pendingApprovals, myOpenRequirements, myRequirements, myApprovals);
  }
}
