package com.runisys.ontodata.portal.taskcenter.application;

import com.runisys.ontodata.sdk.web.ResourceStateConflictException;
import com.runisys.ontodata.portal.taskcenter.application.TaskProjectionEventHandler.ProcessingResult;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalEventInboxRepository;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import com.runisys.ontodata.portal.taskcenter.infrastructure.TaskProjectionKafkaConfiguration;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.stereotype.Service;

/**
 * 投影重放重建（WP-03 / EVT-02 / 收敛文档 §8.1：投影可由事件流重建，权威状态在源系统）。
 *
 * <p><b>操作前提（执行方必须确认）：</b>
 *
 * <ol>
 *   <li>事件总线已启用（{@code ontodata.events.kafka.enabled=true}）且 broker 可达；
 *   <li>主题保留期覆盖需要重建的历史窗口（ADR-006 建议业务事件主题不少于 30 天）；
 *   <li>建议在维护窗口执行：重建第 2 步会清空 portal_task，投影在重放追平前处于"部分恢复" 状态，期间任务中心列表/详情读到的是不完整视图。
 * </ol>
 *
 * <p><b>影响与并发语义：</b>
 *
 * <ol>
 *   <li>正常消费组 {@code portal.task-projection} 的位点不受影响——重建使用一次性消费组 {@code
 *       portal.task-projection-rebuild-<timestamp>} 从头（earliest）订阅全部主题， 复用与正常消费完全相同的"inbox 幂等 +
 *       乱序防护"路径；
 *   <li>重建期间新到的事件仍由正常消费组消费并写入投影：重放按 aggregateVersion 升序应用， 正常消费的事件版本更高（或经 event_version
 *       高水位裁决），两条路径最终收敛一致；
 *   <li>重建结束后清理一次性组的 inbox 痕迹（该组不会再用，去重空间无保留价值）；
 *   <li>同一时刻只允许一个重建（进程内串行化），重复触发直接 409。
 * </ol>
 */
@Service
public class ProjectionRebuildService {

  private static final Logger log = LoggerFactory.getLogger(ProjectionRebuildService.class);

  /** 连续空轮询达到该次数即视为已追平日志末尾（earliest 重放到当前位点）。 */
  private static final int EMPTY_POLLS_UNTIL_CAUGHT_UP = 3;

  /** 重建整体超时兜底：防止主题数据量超预期导致管理端点无限挂起。 */
  private static final long REBUILD_TIMEOUT_MILLIS = 120_000L;

  private final PortalTaskRepository taskRepository;
  private final PortalEventInboxRepository inboxRepository;
  private final TaskProjectionEventHandler handler;
  private final KafkaProperties kafkaProperties;
  private final boolean kafkaEnabled;

  /** 进程内串行化守卫：同时只允许一个重建在跑，重复触发返回 409。 */
  private final java.util.concurrent.atomic.AtomicBoolean rebuildRunning =
      new java.util.concurrent.atomic.AtomicBoolean(false);

  public ProjectionRebuildService(
      PortalTaskRepository taskRepository,
      PortalEventInboxRepository inboxRepository,
      TaskProjectionEventHandler handler,
      KafkaProperties kafkaProperties,
      @Value("${ontodata.events.kafka.enabled:true}") boolean kafkaEnabled) {
    this.taskRepository = taskRepository;
    this.inboxRepository = inboxRepository;
    this.handler = handler;
    this.kafkaProperties = kafkaProperties;
    this.kafkaEnabled = kafkaEnabled;
  }

  /** 重建结果统计（REST 响应体，供运维核对重放量与裁决分布）。 */
  public record RebuildSummary(
      String consumerGroup,
      long polled,
      long applied,
      long duplicate,
      long stale,
      long unknown,
      long tasks,
      long elapsedMillis) {}

  /**
   * 清空任务投影并用一次性消费组从头重放全部订阅主题。
   *
   * @throws ResourceStateConflictException 事件总线未启用，或已有重建在进行
   */
  public RebuildSummary rebuild() {
    if (!kafkaEnabled) {
      throw new ResourceStateConflictException(
          "事件总线未启用（ontodata.events.kafka.enabled=false），无法从事件流重放重建投影");
    }
    if (!rebuildRunning.compareAndSet(false, true)) {
      throw new ResourceStateConflictException("已有投影重建在进行中");
    }
    try {
      long startedAt = System.currentTimeMillis();
      String rebuildGroup =
          TaskProjectionKafkaConfiguration.REBUILD_GROUP_PREFIX + System.currentTimeMillis();
      log.warn("开始投影重放重建：消费组={}，将清空 portal_task 并从头重放全部主题", rebuildGroup);

      // 1) 清空投影（投影不是权威数据，可由事件流整体重建）
      taskRepository.deleteAll();

      // 2) 一次性消费组从头订阅（不复用正常组位点；enable.auto.commit=false，位点无需提交）
      Map<String, Object> props = new HashMap<>(kafkaProperties.buildConsumerProperties());
      props.put(ConsumerConfig.GROUP_ID_CONFIG, rebuildGroup);
      props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
      props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
      long polled = 0;
      long applied = 0;
      long duplicate = 0;
      long stale = 0;
      long unknown = 0;
      try (Consumer<String, String> consumer =
          new DefaultKafkaConsumerFactory<String, String>(
                  props, new StringDeserializer(), new StringDeserializer())
              .createConsumer()) {
        consumer.subscribe(TaskProjectionKafkaConfiguration.TOPICS);
        int emptyPolls = 0;
        long deadline = startedAt + REBUILD_TIMEOUT_MILLIS;
        while (emptyPolls < EMPTY_POLLS_UNTIL_CAUGHT_UP && System.currentTimeMillis() < deadline) {
          ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
          if (records.isEmpty()) {
            emptyPolls++;
            continue;
          }
          emptyPolls = 0;
          for (var record : records) {
            polled++;
            ProcessingResult result = handler.handle(rebuildGroup, record.value());
            switch (result) {
              case APPLIED -> applied++;
              case DUPLICATE -> duplicate++;
              case STALE -> stale++;
              case UNKNOWN -> unknown++;
            }
          }
        }
      } finally {
        // 3) 一次性组的 inbox 痕迹清理（该组不会再用）
        inboxRepository.deleteByConsumerId(rebuildGroup);
      }

      RebuildSummary summary =
          new RebuildSummary(
              rebuildGroup,
              polled,
              applied,
              duplicate,
              stale,
              unknown,
              taskRepository.count(),
              System.currentTimeMillis() - startedAt);
      log.warn("投影重放重建完成：{}", summary);
      return summary;
    } finally {
      rebuildRunning.set(false);
    }
  }
}
