package com.runisys.ontodata.portal.taskcenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.sdk.web.PageResponse;
import com.runisys.ontodata.portal.taskcenter.application.PortalTaskService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统一任务中心 REST 接口。
 *
 * <p>查询路径（GET）读取任务投影（WP-03：投影由事件订阅驱动，权威状态在源系统，可由事件流重建）。
 *
 * <p>PUT /tasks/{taskId} 为 WP-03 之前的回调式幂等 upsert——<b>过渡兼容保留</b>，事件链路稳定后 随 ADR-006
 * 弃用边界下线（源系统不再被要求主动推送）。
 */
@RestController
@RequestMapping("/api/v1/tasks")
public class PortalTaskController {

  private final PortalTaskService taskService;

  public PortalTaskController(PortalTaskService taskService) {
    this.taskService = taskService;
  }

  /**
   * 回调式幂等 upsert（过渡兼容）。
   *
   * <p>为何不过消费者 inbox：回调请求不携带 eventId/aggregateVersion，没有 inbox 去重键； 其幂等性由自然键 (tenant_id, task_id)
   * 唯一约束 + "进度只增不回退"不变量保证， 与事件路径裁决结果一致（详见 PortalTaskService 类注释）。
   *
   * @deprecated WP-03 起任务投影由事件订阅驱动；本端点过渡兼容保留，事件链路稳定后下线。
   */
  @Deprecated
  @PutMapping("/{taskId}")
  public PortalTaskResponse upsert(
      @PathVariable String taskId, @Valid @RequestBody UpsertPortalTaskRequest request) {
    if (!taskId.equals(request.getTaskId())) {
      throw new IllegalArgumentException("路径与请求体中的任务标识不一致");
    }
    return taskService.upsert(request);
  }

  @GetMapping("/{taskId}")
  public PortalTaskResponse find(@PathVariable String taskId) {
    return taskService.find(taskId);
  }

  @GetMapping
  public PageResponse<PortalTaskResponse> list(@Valid PageRequestParameters parameters) {
    return taskService.list(parameters);
  }
}
