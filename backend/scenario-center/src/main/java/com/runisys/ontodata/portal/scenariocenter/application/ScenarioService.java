package com.runisys.ontodata.portal.scenariocenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PortalCodeGenerator;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.scenariocenter.api.ScenarioResponse;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.WidgetRequest;
import com.runisys.ontodata.portal.scenariocenter.domain.PortalScenario;
import com.runisys.ontodata.portal.scenariocenter.infrastructure.PortalScenarioRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 场景编排服务（scenario/v1 契约，portal 为权威方）：场景 CRUD + 发布/下线状态机。
 *
 * <p>不变量：
 *
 * <ul>
 *   <li>状态机：DRAFT → PUBLISHED → DEPRECATED（单向，越级/回退 409）；仅 DRAFT 可改；
 *   <li>发布不可变：PUBLISHED 后该 (code, version) 对象不可变，修改走新草稿版本 （{@link #createDraft} 在最高版本上递增补丁号）；
 *   <li>全部精确钉扎：bindings/ontologyRefs 版本 x.y.z 由请求层 bean validation 强制 （latest/通配符
 *       400，与契约负例一致），发布前再经 {@link ScenarioReferenceChecker} 回查引用存在性（fail-closed）；
 *   <li>M5 多租户：全部读写限定本租户，跨租户 code 按不存在处理（404）。
 * </ul>
 */
@Service
public class ScenarioService {

  private static final Map<String, Set<String>> ALLOWED =
      Map.of(
          PortalScenario.STATUS_DRAFT, Set.of(PortalScenario.STATUS_PUBLISHED),
          PortalScenario.STATUS_PUBLISHED, Set.of(PortalScenario.STATUS_DEPRECATED),
          PortalScenario.STATUS_DEPRECATED, Set.of());

  private static final Map<String, String> SORT_FIELDS =
      Map.of("updatedAt", "updatedAt", "code", "code", "version", "version");

  private final PortalScenarioRepository scenarioRepository;
  private final PortalCodeGenerator codeGenerator;
  private final ScenarioReferenceChecker referenceChecker;
  private final ObjectMapper objectMapper;

  public ScenarioService(
      PortalScenarioRepository scenarioRepository,
      PortalCodeGenerator codeGenerator,
      ScenarioReferenceChecker referenceChecker,
      ObjectMapper objectMapper) {
    this.scenarioRepository = scenarioRepository;
    this.codeGenerator = codeGenerator;
    this.referenceChecker = referenceChecker;
    this.objectMapper = objectMapper;
  }

  /** 创建场景：初始版本固定 1.0.0 草稿（编码 scn-* 服务端生成，创建后不可变）。 */
  @Transactional
  public ScenarioResponse create(UpsertScenarioRequest request) {
    validateAssembly(request);
    PortalScenario created =
        scenarioRepository.saveAndFlush(
            new PortalScenario(
                codeGenerator.nextCode("scn"),
                "1.0.0",
                request.getName().trim(),
                trimToNull(request.getDescription()),
                trimToNull(request.getProjectId()),
                toJson(request.getOntologyRefs()),
                toJson(request.getBindings()),
                toJson(request.getPresentation()),
                TenantContext.current(),
                trimToNull(request.getCreatedBy()),
                Instant.now()));
    return ScenarioResponse.from(created, objectMapper);
  }

  /** 更新草稿：仅 DRAFT 可改（PUBLISHED 不可变——修改请创建新草稿版本）。 */
  @Transactional
  public ScenarioResponse update(String code, String version, UpsertScenarioRequest request) {
    PortalScenario scenario = require(code, version);
    if (!PortalScenario.STATUS_DRAFT.equals(scenario.getStatus())) {
      throw new ResourceStateConflictException("场景 " + code + "@" + version + " 已发布，不可修改；请创建新草稿版本");
    }
    validateAssembly(request);
    scenario.updateDraft(
        request.getName().trim(),
        trimToNull(request.getDescription()),
        trimToNull(request.getProjectId()),
        toJson(request.getOntologyRefs()),
        toJson(request.getBindings()),
        toJson(request.getPresentation()),
        Instant.now());
    return ScenarioResponse.from(scenario, objectMapper);
  }

  /** 发布：DRAFT → PUBLISHED；发布前 fail-closed 回查引用存在性（可用宽松模式关闭，默认严格）。 */
  @Transactional
  public ScenarioResponse publish(String code, String version) {
    PortalScenario scenario = require(code, version);
    referenceChecker.checkAll(parseBindings(scenario));
    return ScenarioResponse.from(
        transition(scenario, PortalScenario.STATUS_PUBLISHED), objectMapper);
  }

  /** 下线：PUBLISHED → DEPRECATED。 */
  @Transactional
  public ScenarioResponse deprecate(String code, String version) {
    return ScenarioResponse.from(
        transition(require(code, version), PortalScenario.STATUS_DEPRECATED), objectMapper);
  }

  /** 从当前最高版本派生新草稿版本（补丁号递增），内容整组复制——发布不可变下的修改入口。 */
  @Transactional
  public ScenarioResponse createDraft(String code) {
    PortalScenario latest = latestOf(code);
    PortalScenario draft =
        scenarioRepository.saveAndFlush(
            new PortalScenario(
                latest.getCode(),
                bumpPatch(latest.getVersion()),
                latest.getName(),
                latest.getDescription(),
                latest.getProjectId(),
                latest.getOntologyRefsJson(),
                latest.getBindingsJson(),
                latest.getPresentationJson(),
                TenantContext.current(),
                latest.getCreatedBy(),
                Instant.now()));
    return ScenarioResponse.from(draft, objectMapper);
  }

  /** 详情：默认返回当前最高版本（语义版本比较，非创建时间）。 */
  @Transactional(readOnly = true)
  public ScenarioResponse find(String code) {
    return ScenarioResponse.from(latestOf(code), objectMapper);
  }

  @Transactional(readOnly = true)
  public ScenarioResponse findVersion(String code, String version) {
    return ScenarioResponse.from(require(code, version), objectMapper);
  }

  /** 分页查询：status→场景状态、keyword→名称/编码模糊匹配；排序白名单 updatedAt/code/version。 */
  @Transactional(readOnly = true)
  public PageResponse<ScenarioResponse> list(PageRequestParameters parameters) {
    List<Specification<PortalScenario>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getKeyword() != null) {
      String pattern = "%" + parameters.getKeyword() + "%";
      predicates.add(
          (root, query, builder) ->
              builder.or(
                  builder.like(root.get("name"), pattern),
                  builder.like(root.get("code"), pattern)));
    }
    Specification<PortalScenario> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<PortalScenario> page =
        scenarioRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, scenario -> ScenarioResponse.from(scenario, objectMapper));
  }

  /** 装配跨字段校验：绑定别名不重复；展示配置 widget 必须指向已声明的绑定别名。 */
  private void validateAssembly(UpsertScenarioRequest request) {
    Set<String> aliases = new HashSet<>();
    for (BindingRequest binding : request.getBindings()) {
      String alias = trimToNull(binding.getAlias());
      if (alias != null && !aliases.add(alias)) {
        throw new IllegalArgumentException("绑定别名重复：" + alias);
      }
    }
    if (request.getPresentation() != null && request.getPresentation().getWidgets() != null) {
      for (WidgetRequest widget : request.getPresentation().getWidgets()) {
        if (!aliases.contains(widget.getBindingAlias())) {
          throw new IllegalArgumentException("展示配置引用了不存在的绑定别名：" + widget.getBindingAlias());
        }
      }
    }
  }

  private PortalScenario transition(PortalScenario scenario, String target) {
    Set<String> allowed = ALLOWED.get(scenario.getStatus());
    if (allowed == null || !allowed.contains(target)) {
      throw new ResourceStateConflictException(
          "场景状态 " + scenario.getStatus() + " 不允许流转到 " + target);
    }
    scenario.transition(target, Instant.now());
    return scenario;
  }

  private PortalScenario require(String code, String version) {
    return scenarioRepository
        .findByCodeAndVersionAndTenantId(code, version, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("场景不存在：" + code + "@" + version));
  }

  private PortalScenario latestOf(String code) {
    List<PortalScenario> versions =
        scenarioRepository.findByCodeAndTenantIdOrderByCreatedAtAsc(code, TenantContext.current());
    if (versions.isEmpty()) {
      throw new ResourceNotFoundException("场景不存在：" + code);
    }
    return versions.stream()
        .max(Comparator.comparing(scenario -> semverKey(scenario.getVersion())))
        .orElseThrow();
  }

  /** 语义版本比较键：x.y.z → 定长可比较文本（位段上限 6 位，远超实际版本号）。 */
  private static String semverKey(String version) {
    String[] parts = version.split("\\.");
    return String.format(
        "%06d.%06d.%06d",
        Integer.parseInt(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
  }

  /** 新草稿版本号：在源版本上递增补丁位（1.0.0 → 1.0.1）。 */
  private static String bumpPatch(String version) {
    String[] parts = version.split("\\.");
    return parts[0] + "." + parts[1] + "." + (Integer.parseInt(parts[2]) + 1);
  }

  private List<BindingRequest> parseBindings(PortalScenario scenario) {
    try {
      return objectMapper.readValue(
          scenario.getBindingsJson(), new TypeReference<List<BindingRequest>>() {});
    } catch (JsonProcessingException corrupted) {
      throw new IllegalStateException("场景装配绑定落库数据损坏，无法解析", corrupted);
    }
  }

  private String toJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("场景装配字段序列化失败", impossible);
    }
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
