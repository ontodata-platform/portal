package com.runisys.ontodata.portal.personalcenter.api;

import com.runisys.ontodata.portal.approvalcenter.api.ApprovalRequestResponse;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.personalcenter.application.NotificationService;
import com.runisys.ontodata.portal.personalcenter.application.PersonalCenterService;
import com.runisys.ontodata.portal.requirementcenter.api.RequirementRequestResponse;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 个人中心 REST：身份、我的需求/申请与待办。主体取认证上下文，不再接受 requester 查询参数。 */
@RestController
@RequestMapping("/api/v1/personal")
@Validated
public class PersonalCenterController {

  private final PersonalCenterService personalCenterService;
  private final NotificationService notificationService;

  public PersonalCenterController(
      PersonalCenterService personalCenterService, NotificationService notificationService) {
    this.personalCenterService = personalCenterService;
    this.notificationService = notificationService;
  }

  @GetMapping("/me")
  public PortalIdentityResponse me() {
    return personalCenterService.currentIdentity();
  }

  @GetMapping("/requirements")
  public PageResponse<RequirementRequestResponse> myRequirements(
      @Valid PageRequestParameters parameters) {
    return personalCenterService.myRequirements(parameters);
  }

  @GetMapping("/approvals")
  public PageResponse<ApprovalRequestResponse> myApprovals(
      @Valid PageRequestParameters parameters) {
    return personalCenterService.myApprovals(parameters);
  }

  @GetMapping("/todos")
  public PersonalTodoResponse todos() {
    return personalCenterService.todos();
  }

  @GetMapping("/notifications")
  public PageResponse<NotificationResponse> notifications(@Valid PageRequestParameters parameters) {
    return notificationService.listMine(parameters);
  }

  @GetMapping("/notifications/unread-count")
  public UnreadCountResponse unreadCount() {
    return notificationService.unreadCount();
  }

  @PostMapping("/notifications/{id}/read")
  public NotificationResponse markRead(@PathVariable String id) {
    return notificationService.markRead(id);
  }

  @PostMapping("/notifications/read-all")
  public UnreadCountResponse markAllRead() {
    return notificationService.markAllRead();
  }
}
