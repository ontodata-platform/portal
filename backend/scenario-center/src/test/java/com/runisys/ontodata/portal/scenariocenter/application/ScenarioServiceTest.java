package com.runisys.ontodata.portal.scenariocenter.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.PortalCodeGenerator;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.sdk.web.ResourceNotFoundException;
import com.runisys.ontodata.sdk.web.ResourceStateConflictException;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.PresentationRequest;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.WidgetRequest;
import com.runisys.ontodata.portal.scenariocenter.domain.PortalScenario;
import com.runisys.ontodata.portal.scenariocenter.infrastructure.PortalScenarioRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 场景编排服务单元测试：状态机（DRAFT→PUBLISHED→DEPRECATED 单向）、发布不可变、 装配跨字段校验（别名重复/widget 悬空引用）、新草稿版本派生与租户上下文传播。
 */
@ExtendWith(MockitoExtension.class)
class ScenarioServiceTest {

  @Mock private PortalScenarioRepository scenarioRepository;
  @Mock private ScenarioReferenceChecker referenceChecker;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private ScenarioService service;

  @BeforeEach
  void setUp() {
    service =
        new ScenarioService(
            scenarioRepository, new PortalCodeGenerator(), referenceChecker, objectMapper);
    TenantContext.set("tenant-a");
  }

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void createGeneratesScnCodeWithInitialDraftVersion() {
    when(scenarioRepository.saveAndFlush(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var response = service.create(request("客户质量场景"));

    assertTrue(response.getCode().matches("^scn-[a-z0-9-]{1,64}$"));
    assertEquals("1.0.0", response.getVersion());
    assertEquals(PortalScenario.STATUS_DRAFT, response.getStatus());
    assertEquals("tenant-a", response.getTenantId());
    // 创建不做引用存在性回查（回查只在发布时 fail-closed 执行）
    verify(referenceChecker, never()).checkAll(any());
  }

  @Test
  void createRejectsDuplicatedBindingAlias() {
    UpsertScenarioRequest request = request("别名重复场景");
    BindingRequest second = binding("CAPABILITY", "cap-null-check", "1.4.0");
    second.setAlias("customerData");
    request.setBindings(new java.util.ArrayList<>(request.getBindings()));
    request.getBindings().add(second);

    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> service.create(request));
    assertTrue(error.getMessage().contains("绑定别名重复"));
  }

  @Test
  void createRejectsWidgetPointingToUndeclaredAlias() {
    UpsertScenarioRequest request = request("悬空别名场景");
    PresentationRequest presentation = new PresentationRequest();
    WidgetRequest widget = new WidgetRequest();
    widget.setKind("METRIC");
    widget.setBindingAlias("notDeclared");
    presentation.setWidgets(List.of(widget));
    request.setPresentation(presentation);

    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> service.create(request));
    assertTrue(error.getMessage().contains("绑定别名"));
  }

  @Test
  void publishFollowsStateMachineAndIsImmutableAfterwards() {
    PortalScenario draft = draft("scn-abc123", "1.0.0");
    when(scenarioRepository.findByCodeAndVersionAndTenantId("scn-abc123", "1.0.0", "tenant-a"))
        .thenReturn(Optional.of(draft));

    var published = service.publish("scn-abc123", "1.0.0");
    assertEquals(PortalScenario.STATUS_PUBLISHED, published.getStatus());
    // 发布时 fail-closed 回查引用存在性
    verify(referenceChecker).checkAll(any());

    // 已发布不可变：PUT 与重复发布一律 409
    assertThrows(
        ResourceStateConflictException.class,
        () -> service.update("scn-abc123", "1.0.0", request("改名")));
    assertThrows(
        ResourceStateConflictException.class, () -> service.publish("scn-abc123", "1.0.0"));

    var deprecated = service.deprecate("scn-abc123", "1.0.0");
    assertEquals(PortalScenario.STATUS_DEPRECATED, deprecated.getStatus());
    // 终态防重：下线后不可再流转
    assertThrows(
        ResourceStateConflictException.class, () -> service.deprecate("scn-abc123", "1.0.0"));
  }

  @Test
  void createDraftDerivesNewPatchVersionFromLatest() {
    PortalScenario published = draft("scn-abc123", "1.0.0");
    published.transition(PortalScenario.STATUS_PUBLISHED, Instant.now());
    when(scenarioRepository.findByCodeAndTenantIdOrderByCreatedAtAsc("scn-abc123", "tenant-a"))
        .thenReturn(List.of(published));
    when(scenarioRepository.saveAndFlush(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var draft = service.createDraft("scn-abc123");

    assertEquals("1.0.1", draft.getVersion());
    assertEquals(PortalScenario.STATUS_DRAFT, draft.getStatus());
    assertEquals(published.getBindingsJson(), draft.getBindings().toString());
  }

  @Test
  void findIsTenantScopedAndMissingYields404() {
    when(scenarioRepository.findByCodeAndTenantIdOrderByCreatedAtAsc("scn-abc123", "tenant-a"))
        .thenReturn(List.of());

    assertThrows(ResourceNotFoundException.class, () -> service.find("scn-abc123"));
  }

  private PortalScenario draft(String code, String version) {
    try {
      return new PortalScenario(
          code,
          version,
          "场景",
          null,
          null,
          null,
          objectMapper.writeValueAsString(
              List.of(
                  Map.of(
                      "type", "DATA_SNAPSHOT",
                      "ref", "snap-customer-master",
                      "version", "3.0.0",
                      "alias", "customerData",
                      "sourceSystem", "DATA_PLATFORM"))),
          null,
          "tenant-a",
          null,
          Instant.now());
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private UpsertScenarioRequest request(String name) {
    UpsertScenarioRequest request = new UpsertScenarioRequest();
    request.setName(name);
    request.setBindings(List.of(binding("DATA_SNAPSHOT", "snap-customer-master", "3.0.0")));
    return request;
  }

  private BindingRequest binding(String type, String ref, String version) {
    BindingRequest binding = new BindingRequest();
    binding.setType(type);
    binding.setRef(ref);
    binding.setVersion(version);
    binding.setAlias("customerData");
    binding.setSourceSystem(
        switch (type) {
          case "CAPABILITY" -> "ALGORITHM_TRANSFORM";
          case "WORKFLOW_TEMPLATE" -> "ALGORITHM_RECOMBINE";
          default -> "DATA_PLATFORM";
        });
    return binding;
  }
}
