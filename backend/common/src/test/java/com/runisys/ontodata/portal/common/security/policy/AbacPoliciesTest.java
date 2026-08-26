package com.runisys.ontodata.portal.common.security.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 策略行编译语义测试：种子行复现 M5 行为、fail-closed 收紧、参数开关。 */
class AbacPoliciesTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  private static AbacPolicyRule row(String type, int priority, String paramsJson, boolean enabled) {
    return new AbacPolicyRule(type, priority, paramsJson, enabled, null);
  }

  @Test
  void seededRowsReproduceM5Behavior() {
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(
            List.of(
                row(AbacPolicies.TYPE_TENANT_MATCH, 10, "{\"allowNullResourceTenant\": true}", true),
                row(AbacPolicies.TYPE_CLEARANCE_AT_LEAST, 20, null, true)),
            objectMapper);

    assertTrue(snapshot.allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
    assertFalse(snapshot.allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.CONFIDENTIAL));
    // 跨租户拒绝（即使 SECRET 许可）
    assertFalse(snapshot.allow("tenant-a", DataClassification.SECRET, "tenant-b", DataClassification.PUBLIC));
    // 平台级共享：资源无租户放行（密级裁决仍生效）
    assertTrue(snapshot.allow("tenant-a", DataClassification.SECRET, null, DataClassification.CONFIDENTIAL));
    assertFalse(snapshot.allow("tenant-a", DataClassification.INTERNAL, null, DataClassification.SECRET));
  }

  @Test
  void priorityOrderingIsByPriorityAsc() {
    // 优先级与插入顺序相反，编译后按 priority 升序合取，结果仍一致
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(
            List.of(
                row(AbacPolicies.TYPE_CLEARANCE_AT_LEAST, 20, null, true),
                row(AbacPolicies.TYPE_TENANT_MATCH, 10, null, true)),
            objectMapper);
    assertFalse(snapshot.allow("tenant-a", DataClassification.SECRET, "tenant-b", DataClassification.PUBLIC));
  }

  @Test
  void disabledRulesAreIgnored() {
    // 密级规则禁用后仅剩租户匹配：跨租户被拒但高密级资源同租户可读
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(
            List.of(row(AbacPolicies.TYPE_CLEARANCE_AT_LEAST, 20, null, false),
                row(AbacPolicies.TYPE_TENANT_MATCH, 10, null, true)),
            objectMapper);
    assertTrue(snapshot.allow("tenant-a", DataClassification.PUBLIC, "tenant-a", DataClassification.SECRET));
    assertFalse(snapshot.allow("tenant-a", DataClassification.PUBLIC, "tenant-b", DataClassification.PUBLIC));
  }

  @Test
  void unknownRuleTypeFailsClosed() {
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(List.of(row("TOTALLY_UNKNOWN", 10, null, true)), objectMapper);
    assertFalse(snapshot.allow("tenant-a", DataClassification.SECRET, "tenant-a", DataClassification.PUBLIC));
  }

  @Test
  void tenantSharedTighteningViaParams() {
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(
            List.of(row(AbacPolicies.TYPE_TENANT_MATCH, 10, "{\"allowNullResourceTenant\": false}", true)),
            objectMapper);
    // 资源无租户=平台级共享：收紧后一律要求租户归属
    assertFalse(snapshot.allow("tenant-a", DataClassification.INTERNAL, null, DataClassification.PUBLIC));
    assertTrue(snapshot.allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
  }

  @Test
  void brokenParamsJsonTightensToFailClosed() {
    AbacPolicySnapshot snapshot =
        AbacPolicies.compile(
            List.of(row(AbacPolicies.TYPE_TENANT_MATCH, 10, "{not-json", true)), objectMapper);
    assertFalse(snapshot.allow("tenant-a", DataClassification.INTERNAL, null, DataClassification.PUBLIC));
  }

  @Test
  void compilingEmptyEnabledSetIsRejected() {
    assertThrows(
        IllegalStateException.class,
        () -> AbacPolicies.compile(List.of(), objectMapper));
  }

  @Test
  void builtInDefaultsMatchEngineContract() {
    AbacPolicySnapshot defaults = AbacPolicies.builtInDefaults();
    assertTrue(defaults.allow("t", DataClassification.INTERNAL, "t", DataClassification.PUBLIC));
    assertFalse(defaults.allow("t", DataClassification.INTERNAL, "x", DataClassification.PUBLIC));
  }
}
