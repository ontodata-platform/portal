package com.runisys.ontodata.portal.taskcenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
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
 * <p>PUT /tasks/{taskId} 幂等 upsert：源软件把事件按 taskId 上报，门户折叠重复事件。
 */
@RestController
@RequestMapping("/api/v1/tasks")
public class PortalTaskController {

  private final PortalTaskService taskService;

  public PortalTaskController(PortalTaskService taskService) {
    this.taskService = taskService;
  }

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
