package com.runisys.ontodata.portal.scenariocenter.infrastructure;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * 引用存在性回查测试：宽松模式（enabled=false）整体跳过；严格模式 fail-closed—— 上游不可达（本测试指向不可能监听的端口）即抛中文错误阻断发布；DATA_SNAPSHOT
 * 类型跳过。
 */
class HttpScenarioReferenceCheckerTest {

  private static final String UNREACHABLE = "http://127.0.0.1:1";

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void lenientModeSkipsAllChecks() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(new ObjectMapper(), false, UNREACHABLE, UNREACHABLE);

    assertDoesNotThrow(() -> checker.checkAll(List.of(binding("CAPABILITY"))));
  }

  @Test
  void strictModeFailsClosedWhenTransformUnreachable() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(new ObjectMapper(), true, UNREACHABLE, UNREACHABLE);

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> checker.checkAll(List.of(binding("CAPABILITY"))));
    assertTrue(error.getMessage().contains("无法连接算法转换工具能力目录"));
  }

  @Test
  void strictModeFailsClosedWhenRecombineUnreachable() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(new ObjectMapper(), true, UNREACHABLE, UNREACHABLE);

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> checker.checkAll(List.of(binding("WORKFLOW_TEMPLATE"))));
    assertTrue(error.getMessage().contains("无法连接算法重组平台工作流模板目录"));
  }

  @Test
  void dataSnapshotBindingsAreSkippedUntilContractEndpointFrozen() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(new ObjectMapper(), true, UNREACHABLE, UNREACHABLE);

    assertDoesNotThrow(() -> checker.checkAll(List.of(binding("DATA_SNAPSHOT"))));
  }

  private BindingRequest binding(String type) {
    BindingRequest binding = new BindingRequest();
    binding.setType(type);
    binding.setRef("cap-null-check");
    binding.setVersion("1.4.0");
    binding.setSourceSystem(
        switch (type) {
          case "CAPABILITY" -> "ALGORITHM_TRANSFORM";
          case "WORKFLOW_TEMPLATE" -> "ALGORITHM_RECOMBINE";
          default -> "DATA_PLATFORM";
        });
    return binding;
  }
}
