package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortalWorkbenchRunIntegrationTest {

  private static final int recombinePort = reservePort();

  @DynamicPropertySource
  static void upstream(DynamicPropertyRegistry registry) {
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

  private HttpServer stub;
  private final AtomicInteger submitStatus = new AtomicInteger(201);

  @BeforeEach
  void startStub() throws Exception {
    submitStatus.set(201);
    stub = HttpServer.create(new InetSocketAddress(recombinePort), 0);
    stub.createContext(
        "/api/v1/workflow-templates",
        exchange -> {
          byte[] body =
              """
              {"items":[{"id":"33333333-3333-3333-3333-333333333333","code":"wf-run01",
              "name":"运行测试模板","status":"PUBLISHED","currentVersion":2}],"total":1}
              """
                  .getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.createContext(
        "/api/v1/executions",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          String path = exchange.getRequestURI().getPath();
          if (path.endsWith("/start")) {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
            return;
          }
          int status = submitStatus.get();
          if (status >= 400) {
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
            return;
          }
          byte[] body =
              "{\"taskId\":\"tsk-run01\",\"id\":\"tsk-run01\",\"status\":\"PENDING\"}"
                  .getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(status, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.start();
  }

  @AfterEach
  void stopStub() {
    stub.stop(0);
  }

  @Test
  void submitRunReturnsTaskId() throws Exception {
    mockMvc
        .perform(get("/api/v1/workbench/workflow-templates/wf-run01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(true))
        .andExpect(jsonPath("$.body.code").value("wf-run01"));

    mockMvc
        .perform(
            post("/api/v1/workbench/workflow-templates/wf-run01/runs")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"templateVersion\":2}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.taskId").value("tsk-run01"))
        .andExpect(jsonPath("$.started").value(true));
  }

  @Test
  void submitFailureIsBadGateway() throws Exception {
    submitStatus.set(500);
    mockMvc
        .perform(
            post("/api/v1/workbench/workflow-templates/wf-run01/runs")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"templateVersion\":2}"))
        .andExpect(status().isBadGateway())
        .andExpect(jsonPath("$.code").value("UPSTREAM_FAILED"));
  }
}
