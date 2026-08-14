package com.runisys.ontodata.portal.taskcenter.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * 统一任务中心服务：各软件任务聚合副本的幂等 upsert 与查询。
 *
 * <p>任务权威归产生它的软件（§12.3）：门户副本按 taskId 幂等更新（重复事件不产生 脏数据），进度只增不回退；按状态/来源系统过滤；详情携带 traceId 供源软件对账。
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
    PortalTask existing = taskRepository.findByTaskId(request.getTaskId().trim()).orElse(null);
    if (existing == null) {
      PortalTask created =
          taskRepository.saveAndFlush(
              new PortalTask(
                  request.getTaskId().trim(),
                  request.getTaskType().trim(),
                  request.getOwnerSystem().trim(),
                  trimToNull(request.getParentTaskId()),
                  request.getStatus().trim(),
                  trimToNull(request.getStage()),
                  request.getProgress(),
                  toJson(request.getResourceRefs()),
                  toJson(request.getResultRefs()),
                  trimToNull(request.getTraceId()),
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
          (root, query, builder) -> builder.equal(root.get("ownerSystem"), parameters.getDomain()));
    }
    Specification<PortalTask> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<PortalTask> page =
        taskRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, PortalTaskResponse::from);
  }

  private PortalTask require(String taskId) {
    return taskRepository
        .findByTaskId(taskId)
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
