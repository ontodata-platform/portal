package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 场景发布 DATA_SNAPSHOT 回查（F4a）：草稿创建不回查；发布时回查 data-platform status，仅 READY 放行。 独立 H2
 * 内存库 + JDK HttpServer 桩。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalScenarioSnapshotReferenceIntegrationTest {

  private static final int dataPlatformPort = reservePort();
  private static HttpServer stub;
  private static final AtomicInteger statusCode = new AtomicInteger(200);
  private static final AtomicReference<String> statusBody =
      new AtomicReference<>("{\"snapshotId\":\"snap-customer-master\",\"status\":\"READY\"}");

  @DynamicPropertySource
  static void upstream(DynamicPropertyRegistry registry) {
    registry.add(
        "spring.datasource.url",
        () ->
            "jdbc:h2:mem:portal_scenario_snapshot_ref_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE");
    registry.add(
        "ontodata.upstream.data-platform.base-url", () -> "http://127.0.0.1:" + dataPlatformPort);
  }

  @BeforeAll
  static void startStub() throws Exception {
    stub = HttpServer.create(new InetSocketAddress(dataPlatformPort), 0);
    stub.createContext(
        "/",
        exchange -> {
          byte[] body = statusBody.get().getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(statusCode.get(), body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.start();
  }

  @AfterAll
  static void stopStub() {
    stub.stop(0);
  }

  private static int reservePort() {
    try (java.net.ServerSocket socket = new java.net.ServerSocket(0)) {
      return socket.getLocalPort();
    } catch (IOException failure) {
      throw new IllegalStateException("无法预留端口", failure);
    }
  }

  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;

  private static final String SNAPSHOT_BODY =
      """
      {"name":"快照就绪场景","bindings":[
        {"type":"DATA_SNAPSHOT","ref":"snap-customer-master","version":"3.0.0","alias":"data","sourceSystem":"DATA_PLATFORM"}]}
      """;

  @Test
  void createDraftThenPublishWhenSnapshotReady() throws Exception {
    statusCode.set(200);
    statusBody.set("{\"snapshotId\":\"snap-customer-master\",\"status\":\"READY\"}");

    String created =
        mockMvc
            .perform(
                post("/api/v1/scenarios")
                    .header("X-Tenant-Id", "tenant-a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(SNAPSHOT_BODY))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("PUBLISHED"));
  }

  @Test
  void publishRejectedWhenSnapshotRevoked() throws Exception {
    statusCode.set(200);
    statusBody.set("{\"snapshotId\":\"snap-customer-master\",\"status\":\"REVOKED\"}");

    String created =
        mockMvc
            .perform(
                post("/api/v1/scenarios")
                    .header("X-Tenant-Id", "tenant-a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name":"快照已吊销场景","bindings":[
                          {"type":"DATA_SNAPSHOT","ref":"snap-revoked","version":"1.0.0","alias":"data","sourceSystem":"DATA_PLATFORM"}]}
                        """))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(created).path("code").asText();

    mockMvc
        .perform(
            post("/api/v1/scenarios/{code}/versions/1.0.0/publish", code)
                .header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("数据快照状态未就绪")));
  }
}
