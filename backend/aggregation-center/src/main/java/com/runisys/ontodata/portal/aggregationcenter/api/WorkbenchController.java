package com.runisys.ontodata.portal.aggregationcenter.api;

import com.runisys.ontodata.portal.aggregationcenter.application.WorkbenchService;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 算法工作台聚合：目录/详情只读降级；运行代理重组平台 submit+start。 */
@RestController
@RequestMapping("/api/v1/workbench")
public class WorkbenchController {

  private final WorkbenchService workbenchService;

  public WorkbenchController(WorkbenchService workbenchService) {
    this.workbenchService = workbenchService;
  }

  @GetMapping("/capabilities")
  public UpstreamAggregationResponse capabilities(@Valid PageRequestParameters parameters) {
    return workbenchService.capabilities(parameters);
  }

  @GetMapping("/capabilities/{code}")
  public UpstreamAggregationResponse capability(@PathVariable String code) {
    return workbenchService.capability(code);
  }

  @GetMapping("/workflow-templates")
  public UpstreamAggregationResponse workflowTemplates(@Valid PageRequestParameters parameters) {
    return workbenchService.workflowTemplates(parameters);
  }

  @GetMapping("/workflow-templates/{code}")
  public UpstreamAggregationResponse workflowTemplate(@PathVariable String code) {
    return workbenchService.workflowTemplate(code);
  }

  @PostMapping("/workflow-templates/{code}/runs")
  @ResponseStatus(HttpStatus.CREATED)
  public WorkbenchRunResponse run(
      @PathVariable String code, @Valid @RequestBody SubmitWorkbenchRunRequest request) {
    return workbenchService.run(code, request);
  }
}
