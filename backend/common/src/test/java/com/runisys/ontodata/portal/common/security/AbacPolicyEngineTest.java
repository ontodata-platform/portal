package com.runisys.ontodata.portal.common.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

/** ABAC 策略引擎单元测试：密级比较、租户隔离优先、可见等级过滤。 */
class AbacPolicyEngineTest {

  private final AbacPolicyEngine engine = new AbacPolicyEngine();

  @Test
  void allowWhenSameTenantAndClearanceSufficient() {
    assertTrue(
        engine.allow(
            "tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
    assertTrue(
        engine.allow("tenant-a", DataClassification.SECRET, "tenant-a", DataClassification.SECRET));
  }

  @Test
  void denyWhenClearanceInsufficient() {
    assertFalse(
        engine.allow(
            "tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.CONFIDENTIAL));
  }

  @Test
  void denyCrossTenantEvenWithHighClearance() {
    // 租户隔离是前提：即使 SECRET 许可也不能跨租户
    assertFalse(
        engine.allow("tenant-a", DataClassification.SECRET, "tenant-b", DataClassification.PUBLIC));
  }

  @Test
  void accessibleLevelsAreBoundedByClearanceRank() {
    assertEquals(
        List.of(DataClassification.PUBLIC, DataClassification.INTERNAL),
        engine.accessibleLevels(DataClassification.INTERNAL));
    assertEquals(
        List.of(
            DataClassification.PUBLIC,
            DataClassification.INTERNAL,
            DataClassification.CONFIDENTIAL,
            DataClassification.SECRET),
        engine.accessibleLevels(DataClassification.SECRET));
  }

  @Test
  void classificationParsingIsStrict() {
    assertEquals(DataClassification.PUBLIC, DataClassification.fromString(null));
    assertEquals(DataClassification.PUBLIC, DataClassification.fromString(""));
    assertEquals(DataClassification.CONFIDENTIAL, DataClassification.fromString("confidential"));
    assertThrows(IllegalArgumentException.class, () -> DataClassification.fromString("BOGUS"));
  }
}
