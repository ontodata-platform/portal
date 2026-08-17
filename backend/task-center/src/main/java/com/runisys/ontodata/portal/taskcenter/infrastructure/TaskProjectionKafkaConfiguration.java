package com.runisys.ontodata.portal.taskcenter.infrastructure;

import java.util.List;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.CommonErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * 任务投影 Kafka 消费配置（WP-03 / ADR-006）。
 *
 * <p>开关 {@code ontodata.events.kafka.enabled}（默认 true）：显式置 false 时整个消费装配不注册
 * （测试与未部署总线的环境使用）。bootstrap 由 {@code spring.kafka.bootstrap-servers} 提供 （server 模块 application.yml
 * 绑定环境变量 KAFKA_BOOTSTRAP_SERVERS，默认 localhost:9092）。
 *
 * <p>消费失败策略（ADR-006）：指数退避重试（1s 起步 ×2，上限 30s，最多 5 次），超限后投递死信主题 {@code
 * <topic>.dlq}（与源消息同分区），死信可人工重投；未知事件类型不在此路径——映射层记日志 跳过、不抛错（向前兼容）。
 */
@Configuration
@EnableKafka
@ConditionalOnProperty(
    name = "ontodata.events.kafka.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class TaskProjectionKafkaConfiguration {

  /** 正常消费组（ADR-006：消费组名即独立位点，禁止两用途共用一组）。 */
  public static final String CONSUMER_GROUP = "portal.task-projection";

  /** 一次性重放组前缀：实际组名带时间戳（portal.task-projection-rebuild-<timestamp>）。 */
  public static final String REBUILD_GROUP_PREFIX = "portal.task-projection-rebuild-";

  public static final String TOPIC_TRANSFORM_CAPABILITY = "ontodata.transform.capability.v1";
  public static final String TOPIC_TRANSFORM_BUILD = "ontodata.transform.build.v1";
  public static final String TOPIC_RECOMBINE_WORKFLOW = "ontodata.recombine.workflow.v1";
  public static final String TOPIC_RECOMBINE_EXECUTION = "ontodata.recombine.execution.v1";
  public static final String TOPIC_DATA_SERVICE = "ontodata.data.service.v1";
  public static final String TOPIC_DATA_ASSET = "ontodata.data.asset.v1";

  /** 门户订阅的全部主题（重放重建从头订阅同一清单）。 */
  public static final List<String> TOPICS =
      List.of(
          TOPIC_TRANSFORM_CAPABILITY,
          TOPIC_TRANSFORM_BUILD,
          TOPIC_RECOMBINE_WORKFLOW,
          TOPIC_RECOMBINE_EXECUTION,
          TOPIC_DATA_SERVICE,
          TOPIC_DATA_ASSET);

  /**
   * 监听器容器工厂：复用 Boot 自动装配的 ConsumerFactory（spring.kafka.*），只覆盖错误处理。 反序列化统一 String——信封 JSON 由 {@code
   * TaskProjectionEventHandler} 自行解析校验， 解析失败与业务失败走同一"重试 → 死信"路径。
   */
  @Bean
  ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
      ConsumerFactory<String, String> consumerFactory,
      KafkaTemplate<String, String> kafkaTemplate) {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
        new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory);
    factory.setCommonErrorHandler(errorHandler(kafkaTemplate));
    return factory;
  }

  /** 指数退避约 5 次后投递 {@code <topic>.dlq}（ADR-006 死信命名约定；禁止静默丢弃）。 */
  private CommonErrorHandler errorHandler(KafkaTemplate<String, String> kafkaTemplate) {
    DeadLetterPublishingRecoverer recoverer =
        new DeadLetterPublishingRecoverer(
            kafkaTemplate,
            (record, exception) -> new TopicPartition(record.topic() + ".dlq", record.partition()));
    // ADR-006 建议 5 次指数退避：1s→2s→4s→8s→16s，maxElapsedTime 覆盖 5 个间隔后返回 STOP，
    // 即重试 5 次仍失败则投递死信（Spring Framework 6.1 无 ExponentialBackOffWithMaxRetries，
    // 用 maxElapsedTime 等价限次）
    ExponentialBackOff backOff = new ExponentialBackOff(1_000L, 2.0);
    backOff.setMaxInterval(30_000L);
    backOff.setMaxElapsedTime(31_000L);
    return new DefaultErrorHandler(recoverer, backOff);
  }
}
