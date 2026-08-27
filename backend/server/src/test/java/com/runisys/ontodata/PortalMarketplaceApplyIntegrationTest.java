package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class PortalMarketplaceApplyIntegrationTest {

  private static final int dataPlatformPort = reservePort();

  @DynamicPropertySource
  static void upstream(DynamicPropertyRegistry registry) {
    registry.add(
        "ontodata.upstream.data-platform.base-url", () -> "http://127.0.0.1:" + dataPlatformPort);
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

  private HttpServer stub;
  private final AtomicInteger subscribeStatus = new AtomicInteger(201);

  @BeforeEach
  void startStub() throws Exception {
    subscribeStatus.set(201);
    stub = HttpServer.create(new InetSocketAddress(dataPlatformPort), 0);
    stub.createContext(
        "/api/v1/data-services",
        exchange -> {
          byte[] body =
              """
              {"items":[{"id":"11111111-1111-1111-1111-111111111111","code":"dsv-apply01",
              "name":"申请测试服务","status":"ACTIVE","currentVersion":1}],"total":1}
              """
                  .getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    stub.createContext(
        "/api/v1/data-service-subscriptions",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
          }
          int status = subscribeStatus.get();
          if (status >= 400) {
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
            return;
          }
          byte[] body =
              "{\"id\":\"22222222-2222-2222-2222-222222222222\",\"serviceId\":\"11111111-1111-1111-1111-111111111111\"}"
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
  void applyCreatesApprovalAndDeliversAfterApprove() throws Exception {
    mockMvc
        .perform(get("/api/v1/marketplace/data-services/dsv-apply01"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(true))
        .andExpect(jsonPath("$.body.code").value("dsv-apply01"));

    String applied =
        mockMvc
            .perform(
                post("/api/v1/marketplace/data-services/dsv-apply01/apply")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(applied).path("approvalCode").asText();

    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVED\"}"))
        .andExpect(status().isOk());

    JsonNode approval =
        objectMapper.readTree(
            mockMvc
                .perform(get("/api/v1/approvals/{code}", code))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    org.junit.jupiter.api.Assertions.assertEquals(
        "SUCCEEDED", approval.path("detail").path("deliveryStatus").asText());
    org.junit.jupiter.api.Assertions.assertEquals(
        "22222222-2222-2222-2222-222222222222",
        approval.path("detail").path("subscriptionId").asText());
  }

  @Test
  void retryDeliveryAfterUpstreamFailure() throws Exception {
    subscribeStatus.set(503);
    String applied =
        mockMvc
            .perform(
                post("/api/v1/marketplace/data-services/dsv-apply01/apply")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String code = objectMapper.readTree(applied).path("approvalCode").asText();
    mockMvc
        .perform(
            post("/api/v1/approvals/{code}/decision", code)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVED\"}"))
        .andExpect(status().isOk());

    JsonNode failed =
        objectMapper.readTree(
            mockMvc
                .perform(get("/api/v1/approvals/{code}", code))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    org.junit.jupiter.api.Assertions.assertEquals(
        "FAILED", failed.path("detail").path("deliveryStatus").asText());

    subscribeStatus.set(201);
    mockMvc
        .perform(post("/api/v1/marketplace/applications/{code}/retry-delivery", code))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.detail.deliveryStatus").value("SUCCEEDED"));
  }
}
