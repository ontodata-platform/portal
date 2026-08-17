package com.runisys.ontodata.portal.common.event;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 调度开关：Outbox 发布器依赖 @Scheduled 轮询，统一在此启用调度。
 *
 * <p>发布器 Bean 本身受 {@code ontodata.events.kafka.enabled} 条件装配控制（测试环境显式关闭后无任何调度活动）。
 */
@Configuration
@EnableScheduling
public class OutboxSchedulingConfiguration {}
