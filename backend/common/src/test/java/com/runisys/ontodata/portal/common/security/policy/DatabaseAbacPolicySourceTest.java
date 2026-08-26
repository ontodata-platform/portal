package com.runisys.ontodata.portal.common.security.policy;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 真实策略源测试：缓存命中、空表回退、加载失败回退与旧快照保持。 */
class DatabaseAbacPolicySourceTest {

  private final AbacPolicyRuleRepository repository = mock(AbacPolicyRuleRepository.class);
  private final ObjectMapper objectMapper = new ObjectMapper();

  private static List<AbacPolicyRule> baselineRows() {
    return List.of(
        new AbacPolicyRule(
            AbacPolicies.TYPE_TENANT_MATCH, 10, "{\"allowNullResourceTenant\": true}", true, null),
        new AbacPolicyRule(AbacPolicies.TYPE_CLEARANCE_AT_LEAST, 20, null, true, null));
  }

  @Test
  void seededRowsReproduceBaselineDecisions() {
    when(repository.findByEnabledTrueOrderByPriorityAsc()).thenReturn(baselineRows());
    DatabaseAbacPolicySource source = new DatabaseAbacPolicySource(repository, objectMapper, 3600);
    assertTrue(source.snapshot().allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
    assertFalse(source.snapshot().allow("tenant-a", DataClassification.SECRET, "tenant-b", DataClassification.PUBLIC));
  }

  @Test
  void cachingWithinTtlQueriesRepositoryOnce() {
    when(repository.findByEnabledTrueOrderByPriorityAsc()).thenReturn(baselineRows());
    DatabaseAbacPolicySource source = new DatabaseAbacPolicySource(repository, objectMapper, 3600);
    source.snapshot();
    source.snapshot();
    source.snapshot();
    verify(repository, times(1)).findByEnabledTrueOrderByPriorityAsc();
  }

  @Test
  void emptyTableFallsBackToBuiltInDefaults() {
    when(repository.findByEnabledTrueOrderByPriorityAsc()).thenReturn(List.of());
    DatabaseAbacPolicySource source = new DatabaseAbacPolicySource(repository, objectMapper, 3600);
    // 内置默认=平台级共享放行 + 密级裁决仍生效
    assertTrue(source.snapshot().allow("tenant-a", DataClassification.SECRET, null, DataClassification.INTERNAL));
    assertFalse(source.snapshot().allow("tenant-a", DataClassification.SECRET, "tenant-b", DataClassification.PUBLIC));
    assertFalse(source.snapshot().allow("tenant-a", DataClassification.INTERNAL, null, DataClassification.SECRET));
  }

  @Test
  void databaseFailureWithoutCacheFallsBackToDefaults() {
    when(repository.findByEnabledTrueOrderByPriorityAsc())
        .thenThrow(new IllegalStateException("db down"));
    DatabaseAbacPolicySource source = new DatabaseAbacPolicySource(repository, objectMapper, 3600);
    assertTrue(source.snapshot().allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
    assertFalse(source.snapshot().allow("tenant-a", DataClassification.INTERNAL, "tenant-b", DataClassification.PUBLIC));
  }

  @Test
  void refreshFailureKeepsLastGoodSnapshot() {
    when(repository.findByEnabledTrueOrderByPriorityAsc())
        .thenReturn(baselineRows())
        .thenThrow(new IllegalStateException("db down"));
    // TTL 0：每次访问都触发重新加载，模拟故障发生在两次成功加载之间
    DatabaseAbacPolicySource source = new DatabaseAbacPolicySource(repository, objectMapper, 0);
    AbacPolicySnapshot first = source.snapshot();
    AbacPolicySnapshot second = source.snapshot();
    assertSame(first, second);
    assertTrue(second.allow("tenant-a", DataClassification.INTERNAL, "tenant-a", DataClassification.PUBLIC));
    assertFalse(second.allow("tenant-a", DataClassification.INTERNAL, "tenant-b", DataClassification.PUBLIC));
  }
}
