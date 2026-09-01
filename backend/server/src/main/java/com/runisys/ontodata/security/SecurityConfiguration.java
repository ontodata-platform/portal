package com.runisys.ontodata.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/**
 * 门户安全链改走 SDK 同构实现（放行 health/info/prometheus，缺省 JWT）。
 * 本类只做装配入口，不改 permit 列表。
 */
@Configuration
@Import(com.runisys.ontodata.sdk.security.SecurityConfiguration.class)
public class SecurityConfiguration {}
