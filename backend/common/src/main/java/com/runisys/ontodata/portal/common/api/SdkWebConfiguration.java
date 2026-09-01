package com.runisys.ontodata.portal.common.api;

import com.runisys.ontodata.sdk.web.RequestTraceFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 注册 SDK RequestTraceFilter；不打开 sdk-web 自动装配，以免与本仓 GlobalExceptionHandler 双注册。 */
@Configuration
public class SdkWebConfiguration {

  @Bean
  public RequestTraceFilter requestTraceFilter() {
    return new RequestTraceFilter();
  }
}
