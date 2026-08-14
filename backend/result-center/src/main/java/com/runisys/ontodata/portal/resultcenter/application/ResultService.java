package com.runisys.ontodata.portal.resultcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PermissionContext;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceAccessDeniedException;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.security.AbacPolicyEngine;
import com.runisys.ontodata.portal.common.security.DataClassification;
import com.runisys.ontodata.portal.resultcenter.api.PortalResultResponse;
import com.runisys.ontodata.portal.resultcenter.api.RegisterPortalResultRequest;
import com.runisys.ontodata.portal.resultcenter.domain.PortalResult;
import com.runisys.ontodata.portal.resultcenter.infrastructure.PortalResultRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 结果中心服务：结果引用登记与查询。
 *
 * <p>可追踪率 100%（§13.4）：每个结果必须携带来源系统与结果标识（由接口路径强制）， 门户只存资源引用与元数据；同一 (sourceSystem, resultId)
 * 重复登记按幂等更新折叠； sourceTaskId 关联统一任务中心，形成“任务 → 结果”追踪链。
 */
@Service
public class ResultService {

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("resultId", "resultId");
    fields.put("resultType", "resultType");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final PortalResultRepository resultRepository;
  private final AbacPolicyEngine policyEngine;
  private final ObjectMapper objectMapper;

  public ResultService(
      PortalResultRepository resultRepository,
      AbacPolicyEngine policyEngine,
      ObjectMapper objectMapper) {
    this.resultRepository = resultRepository;
    this.policyEngine = policyEngine;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public PortalResultResponse register(
      String sourceSystem, String resultId, RegisterPortalResultRequest request) {
    Instant now = Instant.now();
    String tenantId = TenantContext.current();
    DataClassification classification = DataClassification.fromString(request.getClassification());
    PortalResult existing =
        resultRepository
            .findBySourceSystemAndResultIdAndTenantId(
                sourceSystem.trim(), resultId.trim(), tenantId)
            .orElse(null);
    if (existing == null) {
      PortalResult created =
          resultRepository.saveAndFlush(
              new PortalResult(
                  resultId.trim(),
                  sourceSystem.trim(),
                  request.getResultType().trim(),
                  toJson(request.getResourceRefs()),
                  toJson(request.getMetadata()),
                  trimToNull(request.getSourceTaskId()),
                  trimToNull(request.getTraceId()),
                  classification,
                  tenantId,
                  now));
      return PortalResultResponse.from(created);
    }
    existing.update(
        request.getResultType().trim(),
        toJson(request.getResourceRefs()),
        toJson(request.getMetadata()),
        trimToNull(request.getSourceTaskId()),
        trimToNull(request.getTraceId()),
        classification,
        now);
    return PortalResultResponse.from(existing);
  }

  @Transactional(readOnly = true)
  public PortalResultResponse find(String sourceSystem, String resultId) {
    PortalResult result = require(sourceSystem, resultId);
    // M5 ABAC：租户隔离之外按密级判定——许可不足 403（明确拒绝，不伪装 404）
    if (!policyEngine.allow(
        TenantContext.current(),
        PermissionContext.clearance(),
        result.getTenantId(),
        result.getClassification())) {
      throw new ResourceAccessDeniedException(
          "数据密级不足：该结果密级为 " + result.getClassification() + "，当前许可密级不允许访问");
    }
    return PortalResultResponse.from(result);
  }

  @Transactional(readOnly = true)
  public PageResponse<PortalResultResponse> list(PageRequestParameters parameters) {
    List<Specification<PortalResult>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    // M5 ABAC：列表只返回许可密级可见的行（不泄露高密级数据的存在性）
    predicates.add(
        (root, query, builder) ->
            root.get("classification")
                .in(policyEngine.accessibleLevels(PermissionContext.clearance())));
    if (parameters.getDomain() != null) {
      predicates.add(
          (root, query, builder) ->
              builder.equal(root.get("sourceSystem"), parameters.getDomain()));
    }
    if (parameters.getType() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("resultType"), parameters.getType()));
    }
    if (parameters.getKeyword() != null) {
      String pattern = "%" + parameters.getKeyword() + "%";
      predicates.add((root, query, builder) -> builder.like(root.get("resultId"), pattern));
    }
    Specification<PortalResult> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<PortalResult> page =
        resultRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, PortalResultResponse::from);
  }

  private PortalResult require(String sourceSystem, String resultId) {
    return resultRepository
        .findBySourceSystemAndResultIdAndTenantId(sourceSystem, resultId, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("结果不存在：" + sourceSystem + "/" + resultId));
  }

  private String toJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("结果引用序列化失败", impossible);
    }
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
