package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 门户聚合端到端（M4 联调）：数据商城/算法工作台经各软件正式 REST 契约读取目录 （真实 HTTP 链路，上游用 JDK HttpServer 桩），并验证降级基线——上游错误/不可达时
 * available=false + 中文提示（200），门户其他页面不受影响（模型降级基线）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalAggregationIntegrationTest {

  private static final int dataPlatformPort = reservePort();
  private static final int transformPort = reservePort();
  private static final int recombinePort = reservePort();

  @DynamicPropertySource
  static void upstreamProperties(DynamicPropertyRegistry registry) {
    registry.add(
        "ontodata.upstream.data-platform.base-url", () -> "http://127.0.0.1:" + dataPlatformPort);
    registry.add("ontodata.upstream.transform.base-url", () -> "http://127.0.0.1:" + transformPort);
    registry.add("ontodata.upstream.recombine.base-url", () -> "http://127.0.0.1:" + recombinePort);
  }

  private static int reservePort() {
    try (java.net.ServerSocket socket = new java.net.ServerSocket(0)) {
      return socket.getLocalPort();
    } catch (IOException failure) {
      throw new IllegalStateException("无法预留端口", failure);
    }
  }

  @Autowired private MockMvc mockMvc;

  private HttpServer dataPlatformStub;
  private HttpServer transformStub;
  private HttpServer recombineStub;
  private final AtomicBoolean failDataPlatform = new AtomicBoolean(false);
  private final AtomicBoolean failTransform = new AtomicBoolean(false);

  /** 管理平台桩捕获到的 X-Tenant-Id（M5 租户上下文透传验收）。 */
  private final AtomicReference<String> capturedTenant = new AtomicReference<>();

  /** 重组平台桩直接断开（模拟不可达，客户端得到 EOF IOException）。 */
  private final AtomicBoolean recombineEof = new AtomicBoolean(false);

  private static final String DATA_SERVICES_BODY =
      "{\"items\":[{\"code\":\"dsv-12345678\",\"name\":\"客户主数据服务\",\"status\":\"ACTIVE\","
          + "\"currentVersion\":1}],\"page\":1,\"size\":20,\"total\":1,\"totalPages\":1}";

  private static final String CAPABILITIES_BODY =
      "{\"items\":[{\"code\":\"cap-12345678\",\"name\":\"订单金额校验\",\"status\":\"ACTIVE\","
          + "\"currentVersion\":\"1.0.0\"}],\"page\":1,\"size\":20,\"total\":1,\"totalPages\":1}";

  private static final String WORKFLOW_TEMPLATES_BODY =
      "{\"items\":[{\"code\":\"wf-12345678\",\"name\":\"订单校验工作流\",\"status\":\"PUBLISHED\","
          + "\"currentVersion\":1}],\"page\":1,\"size\":20,\"total\":1,\"totalPages\":1}";

  @BeforeEach
  void startStubs() throws Exception {
    failDataPlatform.set(false);
    failTransform.set(false);
    recombineEof.set(false);
    capturedTenant.set(null);

    dataPlatformStub =
        jsonStub(
            dataPlatformPort,
            "/api/v1/data-services",
            failDataPlatform,
            DATA_SERVICES_BODY,
            capturedTenant);
    transformStub =
        jsonStub(
            transformPort,
            "/api/v1/capabilities",
            failTransform,
            CAPABILITIES_BODY,
            new AtomicReference<>());
    recombineStub = HttpServer.create(new InetSocketAddress(recombinePort), 0);
    recombineStub.createContext(
        "/api/v1/workflow-templates",
        exchange -> {
          if (recombineEof.get()) {
            exchange.close();
            return;
          }
          byte[] body = WORKFLOW_TEMPLATES_BODY.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    recombineStub.start();
  }

  private HttpServer jsonStub(
      int port, String path, AtomicBoolean failFlag, String okBody, AtomicReference<String> tenant)
      throws Exception {
    HttpServer stub = HttpServer.create(new InetSocketAddress(port), 0);
    stub.createContext(
        path,
        exchange -> {
          tenant.set(exchange.getRequestHeaders().getFirst("X-Tenant-Id"));
          if (failFlag.get()) {
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
            return;
          }
          byte[] body = okBody.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.start();
    return stub;
  }

  @AfterEach
  void stopStubs() {
    dataPlatformStub.stop(0);
    transformStub.stop(0);
    recombineStub.stop(0);
  }

  @Test
  void aggregatesMarketplaceAndWorkbenchFromUpstreamCatalogs() throws Exception {
    mockMvc
        .perform(get("/api/v1/marketplace/data-services"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sourceSystem").value("data-platform"))
        .andExpect(jsonPath("$.available").value(true))
        .andExpect(jsonPath("$.body.items[0].code").value("dsv-12345678"))
        .andExpect(jsonPath("$.body.items[0].name").value("客户主数据服务"));

    mockMvc
        .perform(get("/api/v1/workbench/capabilities"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sourceSystem").value("algorithm-transform"))
        .andExpect(jsonPath("$.available").value(true))
        .andExpect(jsonPath("$.body.items[0].code").value("cap-12345678"));

    mockMvc
        .perform(get("/api/v1/workbench/workflow-templates"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sourceSystem").value("algorithm-recombine"))
        .andExpect(jsonPath("$.available").value(true))
        .andExpect(jsonPath("$.body.items[0].code").value("wf-12345678"));
  }

  @Test
  void propagatesTenantHeaderToUpstream() throws Exception {
    // 请求租户上下文随聚合调用透传到上游软件（M5：门户→各软件租户贯通）
    mockMvc
        .perform(get("/api/v1/marketplace/data-services").header("X-Tenant-Id", "tenant-propagate"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(true));
    Assertions.assertEquals("tenant-propagate", capturedTenant.get(), "上游应收到 X-Tenant-Id 透传头");

    // 缺省头 = default 租户，同样透传
    mockMvc.perform(get("/api/v1/marketplace/data-services")).andExpect(status().isOk());
    Assertions.assertEquals("default", capturedTenant.get(), "缺省租户 default 同样透传");
  }

  @Test
  void degradesGracefullyWhenUpstreamErrors() throws Exception {
    failDataPlatform.set(true);
    failTransform.set(true);

    mockMvc
        .perform(get("/api/v1/marketplace/data-services"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("管理平台")));

    mockMvc
        .perform(get("/api/v1/workbench/capabilities"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("算法转换工具")));

    // 其他上游不受影响
    mockMvc
        .perform(get("/api/v1/workbench/workflow-templates"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(true));
  }

  @Test
  void degradesGracefullyWhenUpstreamUnreachable() throws Exception {
    recombineEof.set(true);

    mockMvc
        .perform(get("/api/v1/workbench/workflow-templates"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("算法重组平台")));

    // 其他上游不受影响
    mockMvc
        .perform(get("/api/v1/marketplace/data-services"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(true));
  }
}
