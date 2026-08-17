package com.runisys.ontodata.portal.taskcenter.infrastructure;

import com.runisys.ontodata.portal.taskcenter.application.TaskProjectionEventHandler;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * 任务投影 Kafka 监听器（WP-03）：订阅六个域主题，把信封 JSON 交给 {@link TaskProjectionEventHandler} 做"inbox 幂等 + 投影更新"。
 *
 * <p>处理逻辑全部在 handler（脱离 broker 可单测）；本类只负责消费位点语义——消费组 {@code
 * portal.task-projection}（ADR-006：组名即独立位点）。开关 {@code ontodata.events.kafka.enabled=false}
 * 时不注册（测试环境）。
 */
@Component
@ConditionalOnProperty(
    name = "ontodata.events.kafka.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class TaskProjectionEventListener {

  private final TaskProjectionEventHandler handler;

  public TaskProjectionEventListener(TaskProjectionEventHandler handler) {
    this.handler = handler;
  }

  @KafkaListener(
      topics = {
        TaskProjectionKafkaConfiguration.TOPIC_TRANSFORM_CAPABILITY,
        TaskProjectionKafkaConfiguration.TOPIC_TRANSFORM_BUILD,
        TaskProjectionKafkaConfiguration.TOPIC_RECOMBINE_WORKFLOW,
        TaskProjectionKafkaConfiguration.TOPIC_RECOMBINE_EXECUTION,
        TaskProjectionKafkaConfiguration.TOPIC_DATA_SERVICE,
        TaskProjectionKafkaConfiguration.TOPIC_DATA_ASSET
      },
      groupId = TaskProjectionKafkaConfiguration.CONSUMER_GROUP)
  public void onMessage(String envelopeJson) {
    handler.handle(TaskProjectionKafkaConfiguration.CONSUMER_GROUP, envelopeJson);
  }
}
