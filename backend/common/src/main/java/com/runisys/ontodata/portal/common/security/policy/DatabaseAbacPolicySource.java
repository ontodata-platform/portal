package com.runisys.ontodata.portal.common.security.policy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 真实策略源：portal_abac_policy 表 + 带 TTL 的快照缓存。
 *
 * <p>回退语义（可用性与安全并重，回退目标永远是保守的内置默认规则）：
 *
 * <ul>
 *   <li>表为空 → 回退内置默认（与 M5 硬编码行为一致）；
 *   <li>加载异常且有最近一次成功快照 → 继续使用旧快照，TTL 后重试；
 *   <li>加载异常且无任何快照 → 回退内置默认。
 * </ul>
 */
@Component
public class DatabaseAbacPolicySource implements AbacPolicySource {

  private static final Logger log = LoggerFactory.getLogger(DatabaseAbacPolicySource.class);

  private final AbacPolicyRuleRepository repository;
  private final ObjectMapper objectMapper;
  private final Duration ttl;

  /** 最近一次生效的快照（含回退产生的），永不为 null。 */
  private volatile AbacPolicySnapshot cached;
  private volatile Instant lastLoadAttempt = Instant.MIN;

  public DatabaseAbacPolicySource(
      AbacPolicyRuleRepository repository,
      ObjectMapper objectMapper,
      @Value("${ontodata.abac.cache-ttl-seconds:60}") long cacheTtlSeconds) {
    this.repository = repository;
    this.objectMapper = objectMapper;
    this.ttl = Duration.ofSeconds(Math.max(0, cacheTtlSeconds));
  }

  @Override
  public AbacPolicySnapshot snapshot() {
    AbacPolicySnapshot current = cached;
    if (current != null && Instant.now().isBefore(lastLoadAttempt.plus(ttl))) {
      return current;
    }
    synchronized (this) {
      current = cached;
      if (current != null && Instant.now().isBefore(lastLoadAttempt.plus(ttl))) {
        return current;
      }
      // 失败路径同样推进时间戳：避免数据库故障期间每个请求都打到 DB
      lastLoadAttempt = Instant.now();
      try {
        List<AbacPolicyRule> rows = repository.findByEnabledTrueOrderByPriorityAsc();
        if (rows == null || rows.isEmpty()) {
          log.warn("ABAC 策略表为空，回退内置默认策略（与 M5 行为一致）");
          cached = AbacPolicies.builtInDefaults();
        } else {
          cached = AbacPolicies.compile(rows, objectMapper);
        }
      } catch (RuntimeException e) {
        if (current == null) {
          log.error("ABAC 策略加载失败且无历史快照，回退内置默认策略", e);
          cached = AbacPolicies.builtInDefaults();
        } else {
          log.error("ABAC 策略刷新失败，继续使用最近一次快照（TTL 后重试）", e);
        }
      }
      return cached;
    }
  }
}
