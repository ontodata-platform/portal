package com.runisys.ontodata.portal.requirementcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PortalIdentityService;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.security.CurrentOperator;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.requirementcenter.api.AssignRequirementRequest;
import com.runisys.ontodata.portal.requirementcenter.api.CreateRequirementRequest;
import com.runisys.ontodata.portal.requirementcenter.api.RequirementRequestResponse;
import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import com.runisys.ontodata.portal.requirementcenter.infrastructure.RequirementRequestRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 需求管理服务：需求单（req-*）接收、去重、分析、分派、计划与关闭。
 *
 * <p>不变量：单向状态机（终态防重 409）；同 (requirementType, 归一化标题) 存在非终态单时
 * 拒绝新登记（409，引导合并）；分派只登记平台内业务软件与引用编码，不替目标软件执行； 完成必须填写 closedNote。
 */
@Service
public class RequirementService {

  /** 状态机白名单：每个当前状态允许流转到的目标状态。 */
  private static final Map<String, Set<String>> ALLOWED;

  /** 平台内业务软件白名单：需求只能分派给平台内软件。 */
  private static final Set<String> ASSIGNEE_SYSTEMS;

  private static final Set<String> TERMINAL_STATUSES =
      Set.of(RequirementRequest.STATUS_COMPLETED, RequirementRequest.STATUS_CANCELED);

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, Set<String>> transitions = new java.util.LinkedHashMap<String, Set<String>>();
    transitions.put(
        RequirementRequest.STATUS_OPEN,
        Set.of(RequirementRequest.STATUS_ANALYZING, RequirementRequest.STATUS_CANCELED));
    transitions.put(
        RequirementRequest.STATUS_ANALYZING,
        Set.of(RequirementRequest.STATUS_ASSIGNED, RequirementRequest.STATUS_CANCELED));
    transitions.put(
        RequirementRequest.STATUS_ASSIGNED, Set.of(RequirementRequest.STATUS_IN_PROGRESS));
    transitions.put(
        RequirementRequest.STATUS_IN_PROGRESS, Set.of(RequirementRequest.STATUS_COMPLETED));
    transitions.put(RequirementRequest.STATUS_COMPLETED, Set.of());
    transitions.put(RequirementRequest.STATUS_CANCELED, Set.of());
    ALLOWED = java.util.Collections.unmodifiableMap(transitions);

    ASSIGNEE_SYSTEMS =
        Set.of(
            "data-platform",
            "algorithm-transform",
            "algorithm-recombine",
            "ontology-platform",
            "mcp-gateway");

    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("status", "status");
    fields.put("code", "code");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final RequirementRequestRepository requirementRepository;
  private final PortalIdentityService identityService;
  private final ObjectMapper objectMapper;

  public RequirementService(
      RequirementRequestRepository requirementRepository,
      PortalIdentityService identityService,
      ObjectMapper objectMapper) {
    this.requirementRepository = requirementRepository;
    this.identityService = identityService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public RequirementRequestResponse create(CreateRequirementRequest request) {
    String requirementType = request.getRequirementType().trim();
    String normalizedTitle = normalize(request.getTitle());
    String tenantId = TenantContext.current();
    RequirementRequest duplicate =
        requirementRepository
            .findFirstByRequirementTypeAndNormalizedTitleAndTenantIdAndStatusNotIn(
                requirementType, normalizedTitle, tenantId, TERMINAL_STATUSES)
            .orElse(null);
    if (duplicate != null) {
      throw new ResourceStateConflictException(
          "存在同类型进行中的需求 " + duplicate.getCode() + "，请合并到已有需求或待其关闭后再登记");
    }
    CurrentOperator.requireMatches(request.getRequester());
    RequirementRequest created =
        requirementRepository.saveAndFlush(
            new RequirementRequest(
                identityService.nextCode("req"),
                requirementType,
                request.getTitle().trim(),
                normalizedTitle,
                trimToNull(request.getDescription()),
                CurrentOperator.name(),
                tenantId,
                Instant.now()));
    return RequirementRequestResponse.from(created);
  }

  @Transactional
  public RequirementRequestResponse analyze(String code) {
    return RequirementRequestResponse.from(
        advance(code, RequirementRequest.STATUS_ANALYZING, null, null, null, null));
  }

  @Transactional
  public RequirementRequestResponse assign(String code, AssignRequirementRequest request) {
    String assigneeSystem = request.getAssigneeSystem().trim();
    if (!ASSIGNEE_SYSTEMS.contains(assigneeSystem)) {
      throw new IllegalArgumentException("分派目标必须是平台内业务软件：" + assigneeSystem);
    }
    return RequirementRequestResponse.from(
        advance(
            code,
            RequirementRequest.STATUS_ASSIGNED,
            assigneeSystem,
            trimToNull(request.getAssigneeRef()),
            toJson(request.getPlan()),
            null));
  }

  @Transactional
  public RequirementRequestResponse startProgress(String code) {
    return RequirementRequestResponse.from(
        advance(code, RequirementRequest.STATUS_IN_PROGRESS, null, null, null, null));
  }

  @Transactional
  public RequirementRequestResponse complete(String code, String closedNote) {
    String note = trimToNull(closedNote);
    if (note == null) {
      throw new IllegalArgumentException("完成需求必须填写结项说明");
    }
    return RequirementRequestResponse.from(
        advance(code, RequirementRequest.STATUS_COMPLETED, null, null, null, note));
  }

  @Transactional
  public RequirementRequestResponse cancel(String code, String closedNote) {
    return RequirementRequestResponse.from(
        advance(
            code, RequirementRequest.STATUS_CANCELED, null, null, null, trimToNull(closedNote)));
  }

  @Transactional
  public RequirementRequestResponse updatePlan(String code, Map<String, Object> plan) {
    RequirementRequest requirement = require(code);
    if (!RequirementRequest.STATUS_OPEN.equals(requirement.getStatus())
        && !RequirementRequest.STATUS_ANALYZING.equals(requirement.getStatus())) {
      throw new ResourceStateConflictException("需求单已分派或已关闭，不允许再调整计划");
    }
    requirement.updatePlan(toJson(plan), Instant.now());
    return RequirementRequestResponse.from(requirement);
  }

  @Transactional(readOnly = true)
  public RequirementRequestResponse find(String code) {
    return RequirementRequestResponse.from(require(code));
  }

  /** 分页查询：status→需求状态、type→需求类型、keyword→标题模糊匹配； 排序白名单限制为 updatedAt/status/code。 */
  @Transactional(readOnly = true)
  public PageResponse<RequirementRequestResponse> list(PageRequestParameters parameters) {
    List<Specification<RequirementRequest>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getType() != null) {
      predicates.add(
          (root, query, builder) ->
              builder.equal(root.get("requirementType"), parameters.getType()));
    }
    if (parameters.getKeyword() != null) {
      String pattern = "%" + parameters.getKeyword() + "%";
      predicates.add((root, query, builder) -> builder.like(root.get("title"), pattern));
    }
    Specification<RequirementRequest> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<RequirementRequest> page =
        requirementRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, RequirementRequestResponse::from);
  }

  /** 状态流转：先校验白名单（终态防重），再应用变更。 */
  private RequirementRequest advance(
      String code,
      String target,
      String assigneeSystem,
      String assigneeRef,
      String planJson,
      String closedNote) {
    RequirementRequest requirement = require(code);
    Set<String> allowed = ALLOWED.get(requirement.getStatus());
    if (allowed == null || !allowed.contains(target)) {
      throw new ResourceStateConflictException(
          "需求单状态 " + requirement.getStatus() + " 不允许流转到 " + target);
    }
    requirement.transition(
        target, assigneeSystem, assigneeRef, planJson, closedNote, Instant.now());
    return requirement;
  }

  private RequirementRequest require(String code) {
    return requirementRepository
        .findByCodeAndTenantId(code, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("需求不存在：" + code));
  }

  /** 归一化标题：去首尾空白、折叠连续空白、转小写（去重键）。 */
  private String normalize(String title) {
    return title.trim().replaceAll("\\s+", " ").toLowerCase();
  }

  private String toJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("需求计划序列化失败", impossible);
    }
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
