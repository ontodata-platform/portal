package com.runisys.ontodata.portal.aggregationcenter.api;

import com.runisys.ontodata.portal.aggregationcenter.application.WorkbenchService;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 算法工作台聚合接口：经算法转换工具/算法重组平台正式 REST 契约读取能力目录与 工作流模板目录（门户只展示与引导，编排与准入在对应软件工作台办理）。 */
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

  @GetMapping("/workflow-templates")
  public UpstreamAggregationResponse workflowTemplates(@Valid PageRequestParameters parameters) {
    return workbenchService.workflowTemplates(parameters);
  }
}
