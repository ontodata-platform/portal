package com.runisys.ontodata.portal.scenariocenter.infrastructure;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * 引用存在性回查测试：宽松模式（enabled=false）整体跳过；严格模式 fail-closed—— 上游不可达（本测试指向不可能监听的端口）即抛中文错误阻断发布；DATA_SNAPSHOT
 * 回查 data-platform 快照 status 端点，仅 READY 放行。
 */
class HttpScenarioReferenceCheckerTest {

  private static final String UNREACHABLE = "http://127.0.0.1:1";

  @AfterEach
  void tearDown() {
    TenantContext.clear();
  }

  @Test
  void lenientModeSkipsAllChecks() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(
            new ObjectMapper(), false, UNREACHABLE, UNREACHABLE, UNREACHABLE);

    assertDoesNotThrow(() -> checker.checkAll(List.of(binding("CAPABILITY"))));
  }

  @Test
  void strictModeFailsClosedWhenTransformUnreachable() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(
            new ObjectMapper(), true, UNREACHABLE, UNREACHABLE, UNREACHABLE);

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> checker.checkAll(List.of(binding("CAPABILITY"))));
    assertTrue(error.getMessage().contains("无法连接算法转换工具能力目录"));
  }

  @Test
  void strictModeFailsClosedWhenRecombineUnreachable() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(
            new ObjectMapper(), true, UNREACHABLE, UNREACHABLE, UNREACHABLE);

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> checker.checkAll(List.of(binding("WORKFLOW_TEMPLATE"))));
    assertTrue(error.getMessage().contains("无法连接算法重组平台工作流模板目录"));
  }

  @Test
  void strictModeFailsClosedWhenDataPlatformUnreachable() {
    HttpScenarioReferenceChecker checker =
        new HttpScenarioReferenceChecker(
            new ObjectMapper(), true, UNREACHABLE, UNREACHABLE, UNREACHABLE);

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> checker.checkAll(List.of(binding("DATA_SNAPSHOT"))));
    assertTrue(error.getMessage().contains("无法连接数据平台"));
  }

  @Test
  void dataSnapshotReadyIsAllowed() throws Exception {
    HttpServer stub = startSnapshotStub(200, "{\"snapshotId\":\"snap-ok\",\"status\":\"READY\"}");
    try {
      HttpScenarioReferenceChecker checker =
          new HttpScenarioReferenceChecker(
              new ObjectMapper(),
              true,
              UNREACHABLE,
              UNREACHABLE,
              "http://127.0.0.1:" + stub.getAddress().getPort());
      assertDoesNotThrow(() -> checker.checkAll(List.of(binding("DATA_SNAPSHOT"))));
    } finally {
      stub.stop(0);
    }
  }

  @Test
  void dataSnapshotNonReadyIsRejected() throws Exception {
    HttpServer stub = startSnapshotStub(200, "{\"snapshotId\":\"snap-ok\",\"status\":\"REVOKED\"}");
    try {
      HttpScenarioReferenceChecker checker =
          new HttpScenarioReferenceChecker(
              new ObjectMapper(),
              true,
              UNREACHABLE,
              UNREACHABLE,
              "http://127.0.0.1:" + stub.getAddress().getPort());
      IllegalArgumentException error =
          assertThrows(
              IllegalArgumentException.class,
              () -> checker.checkAll(List.of(binding("DATA_SNAPSHOT"))));
      assertTrue(error.getMessage().contains("数据快照状态未就绪"));
    } finally {
      stub.stop(0);
    }
  }

  @Test
  void forwardsCurrentUserBearerToUpstream() throws Exception {
    AtomicReference<String> authorization = new AtomicReference<>();
    HttpServer stub = startSnapshotStub(200, "{\"status\":\"READY\"}", authorization);
    Jwt jwt =
        new Jwt(
            "alice-token",
            Instant.now(),
            Instant.now().plusSeconds(60),
            Map.of("alg", "none"),
            Map.of("sub", "alice", "tenant_id", "tenant-a"));
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken(jwt, "n/a", List.of()));
    try {
      HttpScenarioReferenceChecker checker =
          new HttpScenarioReferenceChecker(
              new ObjectMapper(),
              true,
              UNREACHABLE,
              UNREACHABLE,
              "http://127.0.0.1:" + stub.getAddress().getPort());
      checker.checkAll(List.of(binding("DATA_SNAPSHOT")));
      assertEquals("Bearer alice-token", authorization.get());
    } finally {
      SecurityContextHolder.clearContext();
      stub.stop(0);
    }
  }

  @Test
  void dataSnapshotMissingIsRejected() throws Exception {
    HttpServer stub = startSnapshotStub(404, "");
    try {
      HttpScenarioReferenceChecker checker =
          new HttpScenarioReferenceChecker(
              new ObjectMapper(),
              true,
              UNREACHABLE,
              UNREACHABLE,
              "http://127.0.0.1:" + stub.getAddress().getPort());
      IllegalArgumentException error =
          assertThrows(
              IllegalArgumentException.class,
              () -> checker.checkAll(List.of(binding("DATA_SNAPSHOT"))));
      assertTrue(error.getMessage().contains("数据快照不存在"));
    } finally {
      stub.stop(0);
    }
  }

  private static HttpServer startSnapshotStub(int status, String json) throws Exception {
    return startSnapshotStub(status, json, null);
  }

  private static HttpServer startSnapshotStub(
      int status, String json, AtomicReference<String> authorization) throws Exception {
    HttpServer stub = HttpServer.create(new InetSocketAddress(0), 0);
    stub.createContext(
        "/",
        exchange -> {
          if (authorization != null) {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
          }
          byte[] body = json.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.start();
    return stub;
  }

  private BindingRequest binding(String type) {
    BindingRequest binding = new BindingRequest();
    binding.setType(type);
    binding.setRef("cap-null-check");
    binding.setVersion("1.4.0");
    binding.setSourceSystem(
        switch (type) {
          case "CAPABILITY" -> "ALGORITHM_TRANSFORM";
          case "WORKFLOW_TEMPLATE" -> "ALGORITHM_RECOMBINE";
          default -> "DATA_PLATFORM";
        });
    return binding;
  }
}
