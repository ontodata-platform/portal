package com.runisys.ontodata.portal.personalcenter.application;

import com.runisys.ontodata.portal.approvalcenter.application.ApprovalDecidedApplicationEvent;
import com.runisys.ontodata.portal.common.event.TaskTerminalApplicationEvent;
import com.runisys.ontodata.portal.personalcenter.domain.PortalNotification;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** 把审批决定与任务终态投影为通知（同步监听，便于集成测试无 AFTER_COMMIT 边界）。 */
@Component
public class NotificationEventListener {

  private final NotificationService notificationService;

  public NotificationEventListener(NotificationService notificationService) {
    this.notificationService = notificationService;
  }

  @EventListener
  public void onApprovalDecided(ApprovalDecidedApplicationEvent event) {
    if (event.getRequester() == null || event.getRequester().isBlank()) {
      return;
    }
    String title = "审批" + ("APPROVED".equals(event.getDecision()) ? "已通过" : "已驳回") + "：" + event.getTitle();
    notificationService.record(
        event.getRequester(),
        PortalNotification.TYPE_APPROVAL_DECIDED,
        title,
        event.getApprovalCode() + " " + event.getDecision(),
        event.getApprovalCode(),
        event.getTenantId());
  }

  @EventListener
  public void onTaskTerminal(TaskTerminalApplicationEvent event) {
    notificationService.record(
        PortalNotification.RECIPIENT_TENANT,
        PortalNotification.TYPE_TASK_COMPLETED,
        "任务到达终态：" + event.getTaskId(),
        event.getSourceSystem() + " " + event.getStatus(),
        event.getTaskId(),
        event.getTenantId());
  }
}
