package com.runisys.ontodata;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 统一管理门户启动入口：聚合展示与引导，不做业务权威（端口 18085）。 */
@SpringBootApplication
public class PortalApplication {

  public static void main(String[] args) {
    SpringApplication.run(PortalApplication.class, args);
  }
}
