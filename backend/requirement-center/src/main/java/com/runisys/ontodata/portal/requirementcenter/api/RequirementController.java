package com.runisys.ontodata.portal.requirementcenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.sdk.web.PageResponse;
import com.runisys.ontodata.portal.requirementcenter.application.RequirementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 需求管理 REST 接口：状态流转逐动作暴露（分析/分派/进行中/完成/取消）， 终态重复流转 409；同类型同标题非终态重复登记 409（去重）。 */
@RestController
@RequestMapping("/api/v1/requirements")
public class RequirementController {

  private final RequirementService requirementService;

  public RequirementController(RequirementService requirementService) {
    this.requirementService = requirementService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RequirementRequestResponse create(@Valid @RequestBody CreateRequirementRequest request) {
    return requirementService.create(request);
  }

  @PostMapping("/{code}/analyze")
  public RequirementRequestResponse analyze(@PathVariable String code) {
    return requirementService.analyze(code);
  }

  @PostMapping("/{code}/assign")
  public RequirementRequestResponse assign(
      @PathVariable String code, @Valid @RequestBody AssignRequirementRequest request) {
    return requirementService.assign(code, request);
  }

  @PostMapping("/{code}/progress")
  public RequirementRequestResponse startProgress(@PathVariable String code) {
    return requirementService.startProgress(code);
  }

  @PostMapping("/{code}/complete")
  public RequirementRequestResponse complete(
      @PathVariable String code, @Valid @RequestBody CompleteRequirementRequest request) {
    return requirementService.complete(code, request.getClosedNote());
  }

  @PostMapping("/{code}/cancel")
  public RequirementRequestResponse cancel(
      @PathVariable String code, @Valid @RequestBody CancelRequirementRequest request) {
    return requirementService.cancel(code, request.getClosedNote());
  }

  @PutMapping("/{code}/plan")
  public RequirementRequestResponse updatePlan(
      @PathVariable String code, @Valid @RequestBody UpdatePlanRequirementRequest request) {
    return requirementService.updatePlan(code, request.getPlan());
  }

  @GetMapping("/{code}")
  public RequirementRequestResponse find(@PathVariable String code) {
    return requirementService.find(code);
  }

  @GetMapping
  public PageResponse<RequirementRequestResponse> list(@Valid PageRequestParameters parameters) {
    return requirementService.list(parameters);
  }
}
