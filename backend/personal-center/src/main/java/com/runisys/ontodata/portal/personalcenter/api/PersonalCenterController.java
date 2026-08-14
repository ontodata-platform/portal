package com.runisys.ontodata.portal.personalcenter.api;

import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.personalcenter.application.PersonalCenterService;
import com.runisys.ontodata.portal.requirementcenter.api.RequirementRequestResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 个人中心 REST 接口（总体设计 §5 个人中心首版）：我的需求/我的申请/待办统计。 requester 由调用方显式传入（M5 IAM 对接后改为认证上下文）。 */
@RestController
@RequestMapping("/api/v1/personal")
@Validated
public class PersonalCenterController {

  private final PersonalCenterService personalCenterService;

  public PersonalCenterController(PersonalCenterService personalCenterService) {
    this.personalCenterService = personalCenterService;
  }

  @GetMapping("/requirements")
  public PageResponse<RequirementRequestResponse> myRequirements(
      @RequestParam @NotBlank(message = "用户不能为空") @Size(max = 64, message = "用户不能超过 64 个字符")
          String requester,
      @Valid PageRequestParameters parameters) {
    return personalCenterService.myRequirements(requester, parameters);
  }

  @GetMapping("/approvals")
  public PageResponse<ApprovalRequestResponse> myApprovals(
      @RequestParam @NotBlank(message = "用户不能为空") @Size(max = 64, message = "用户不能超过 64 个字符")
          String requester,
      @Valid PageRequestParameters parameters) {
    return personalCenterService.myApprovals(requester, parameters);
  }

  @GetMapping("/todos")
  public PersonalTodoResponse todos(
      @RequestParam @NotBlank(message = "用户不能为空") @Size(max = 64, message = "用户不能超过 64 个字符")
          String requester) {
    return personalCenterService.todos(requester);
  }
}
