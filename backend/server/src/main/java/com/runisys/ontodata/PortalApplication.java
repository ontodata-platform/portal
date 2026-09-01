package com.runisys.ontodata;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 统一管理门户启动入口：聚合展示与引导，不做业务权威（端口 18085）。

  WP-07 Outbox → Kafka 发布器依赖 {@code @EnableScheduling}，否则审批决定留在
  outbox_event.published_at=NULL，agent-runtime / mcp-gateway 无法被唤醒。
 */
@SpringBootApplication(scanBasePackages = {"com.runisys.ontodata.portal", "com.runisys.ontodata.security"})
@EnableScheduling
public class PortalApplication {

  public static void main(String[] args) {
    SpringApplication.run(PortalApplication.class, args);
  }
}
