package com.runisys.ontodata.portal.approvalcenter.api;

import com.runisys.ontodata.portal.approvalcenter.application.ApprovalService;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 审批中心 REST 接口。
 *
 * <p>创建与决策分离：业务软件（MCP 网关）只创建审批单；人工决策通过 POST /approvals/{code}/decision 落库，终态重复决策 409。
 */
@RestController
@RequestMapping("/api/v1/approvals")
public class ApprovalController {

  private final ApprovalService approvalService;

  public ApprovalController(ApprovalService approvalService) {
    this.approvalService = approvalService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApprovalRequestResponse create(@Valid @RequestBody CreateApprovalRequest request) {
    return approvalService.create(request);
  }

  @PostMapping("/{code}/decision")
  public ApprovalRequestResponse decide(
      @PathVariable String code, @Valid @RequestBody DecideApprovalRequest request) {
    return approvalService.decide(code, request);
  }

  @GetMapping("/{code}")
  public ApprovalRequestResponse find(@PathVariable String code) {
    return approvalService.find(code);
  }

  @GetMapping
  public PageResponse<ApprovalRequestResponse> list(@Valid PageRequestParameters parameters) {
    return approvalService.list(parameters);
  }
}
