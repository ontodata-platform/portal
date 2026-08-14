package com.runisys.ontodata;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 多租户隔离端到端（M5 基础）：X-Tenant-Id 请求头装载租户上下文，任务/审批按租户隔离 （列表互不可见、跨租户 find 404）；缺省头 = default 租户；非法租户标识
 * 400。
 *
 * <p>独立 H2 内存库，避免与主集成测试共享库交叉污染。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(
    properties =
        "spring.datasource.url=jdbc:h2:mem:portal_tenant_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
class PortalTenantIntegrationTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void tenantHeaderIsolatesTasksAndApprovals() throws Exception {
    // tenant-a 创建任务与审批
    mockMvc
        .perform(
            put("/api/v1/tasks/task-tenant")
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"taskId":"task-tenant","taskType":"DATA_INGEST","ownerSystem":"data-platform",
                     "status":"RUNNING","progress":10,"resourceRefs":[],"resultRefs":[]}
                    """))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            post("/api/v1/approvals")
                .header("X-Tenant-Id", "tenant-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"approvalType":"DATA_GRANT","sourceSystem":"data-platform",
                     "title":"租户 A 的审批","requester":"alice"}
                    """))
        .andExpect(status().isCreated());

    // tenant-a 可见
    mockMvc
        .perform(get("/api/v1/tasks/task-tenant").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.taskId").value("task-tenant"));
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

    // tenant-b 隔离：列表不可见、find 404、upsert 同 taskId 落到 tenant-b（幂等键含租户维度）
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mockMvc
        .perform(get("/api/v1/tasks/task-tenant").header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(get("/api/v1/approvals").header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));

    mockMvc
        .perform(
            put("/api/v1/tasks/task-tenant")
                .header("X-Tenant-Id", "tenant-b")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"taskId":"task-tenant","taskType":"DATA_INGEST","ownerSystem":"data-platform",
                     "status":"RUNNING","progress":20,"resourceRefs":[],"resultRefs":[]}
                    """))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "tenant-b"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "tenant-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1));

    // 缺省头 = default 租户：既看不到 tenant-a 也看不到 tenant-b
    mockMvc
        .perform(get("/api/v1/tasks"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));

    // 非法租户标识 400
    mockMvc
        .perform(get("/api/v1/tasks").header("X-Tenant-Id", "BAD TENANT!"))
        .andExpect(status().isBadRequest());
  }
}
