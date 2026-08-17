package com.runisys.ontodata.portal.taskcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.taskcenter.api.PortalTaskResponse;
import com.runisys.ontodata.portal.taskcenter.api.UpsertPortalTaskRequest;
import com.runisys.ontodata.portal.taskcenter.domain.PortalTask;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 统一任务中心服务：各源系统任务投影的查询，与过渡兼容的回调式幂等 upsert。
 *
 * <p>投影语义（WP-03，收敛文档 §8.1）：门户任务是源系统任务状态的事件投影——权威状态在源系统， 投影可由事件流重放重建；按 taskId
 * 幂等更新（重复事件不产生脏数据），进度只增不回退； 按状态/来源系统过滤；详情携带 traceId 供源系统对账。
 *
 * <p>{@link #upsert} 为 WP-03 之前的回调路径（过渡兼容，事件链路稳定后下线）：因回调请求本身 不携带 eventId/aggregateVersion，无法过消费者
 * inbox 幂等表——其幂等性由自然键 (tenant_id, task_id) 唯一约束 + "进度只增不回退"不变量保证，与事件路径的裁决结果一致。
 */
@Service
public class PortalTaskService {

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("status", "status");
    fields.put("taskId", "taskId");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final PortalTaskRepository taskRepository;
  private final ObjectMapper objectMapper;

  public PortalTaskService(PortalTaskRepository taskRepository, ObjectMapper objectMapper) {
    this.taskRepository = taskRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public PortalTaskResponse upsert(UpsertPortalTaskRequest request) {
    Instant now = Instant.now();
    String tenantId = TenantContext.current();
    PortalTask existing =
        taskRepository.findByTaskIdAndTenantId(request.getTaskId().trim(), tenantId).orElse(null);
    if (existing == null) {
      PortalTask created =
          taskRepository.saveAndFlush(
              new PortalTask(
                  request.getTaskId().trim(),
                  request.getTaskType().trim(),
                  request.getSourceSystem().trim(),
                  trimToNull(request.getParentTaskId()),
                  request.getStatus().trim(),
                  trimToNull(request.getStage()),
                  request.getProgress(),
                  toJson(request.getResourceRefs()),
                  toJson(request.getResultRefs()),
                  trimToNull(request.getTraceId()),
                  tenantId,
                  now));
      return PortalTaskResponse.from(created);
    }
    existing.update(
        request.getStatus().trim(),
        trimToNull(request.getStage()),
        request.getProgress(),
        toJson(request.getResourceRefs()),
        toJson(request.getResultRefs()),
        trimToNull(request.getTraceId()),
        now);
    return PortalTaskResponse.from(existing);
  }

  @Transactional(readOnly = true)
  public PortalTaskResponse find(String taskId) {
    return PortalTaskResponse.from(require(taskId));
  }

  /**
   * 分页查询：status→任务状态、type→任务类型（大写编码）、domain→来源系统（小写软件名）、 keyword 暂不参与；排序白名单限制为
   * updatedAt/status/taskId。
   */
  @Transactional(readOnly = true)
  public PageResponse<PortalTaskResponse> list(PageRequestParameters parameters) {
    List<Specification<PortalTask>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getType() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("taskType"), parameters.getType()));
    }
    if (parameters.getDomain() != null) {
      predicates.add(
          (root, query, builder) ->
              builder.equal(root.get("sourceSystem"), parameters.getDomain()));
    }
    Specification<PortalTask> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<PortalTask> page =
        taskRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, PortalTaskResponse::from);
  }

  private PortalTask require(String taskId) {
    return taskRepository
        .findByTaskIdAndTenantId(taskId, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("任务不存在：" + taskId));
  }

  private String toJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException impossible) {
      throw new IllegalStateException("任务引用序列化失败", impossible);
    }
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
