package com.runisys.ontodata.portal.personalcenter.application;

import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.security.CurrentOperator;
import com.runisys.ontodata.portal.personalcenter.api.NotificationResponse;
import com.runisys.ontodata.portal.personalcenter.api.UnreadCountResponse;
import com.runisys.ontodata.portal.personalcenter.domain.PortalNotification;
import com.runisys.ontodata.portal.personalcenter.infrastructure.PortalNotificationRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 通知收件箱：按当前主体 + 租户广播（recipient=*）可见；写入按自然键去重。
 */
@Service
public class NotificationService {

  private final PortalNotificationRepository notificationRepository;

  public NotificationService(PortalNotificationRepository notificationRepository) {
    this.notificationRepository = notificationRepository;
  }

  @Transactional
  public void record(
      String recipient,
      String type,
      String title,
      String body,
      String resourceRef,
      String tenantId) {
    if (notificationRepository
        .findByTenantIdAndTypeAndResourceRefAndRecipient(tenantId, type, resourceRef, recipient)
        .isPresent()) {
      return;
    }
    try {
      notificationRepository.saveAndFlush(
          new PortalNotification(
              recipient, type, title, body, resourceRef, tenantId, Instant.now()));
    } catch (DataIntegrityViolationException duplicate) {
      // 并发双写：唯一键兜底
    }
  }

  @Transactional(readOnly = true)
  public PageResponse<NotificationResponse> listMine(PageRequestParameters parameters) {
    List<String> recipients = visibleRecipients();
    Page<PortalNotification> page =
        notificationRepository.findByTenantIdAndRecipientInOrderByCreatedAtDesc(
            TenantContext.current(),
            recipients,
            PageRequest.of(Math.max(parameters.getPage() - 1, 0), parameters.getSize()));
    return PageResponse.map(page, NotificationResponse::from);
  }

  @Transactional(readOnly = true)
  public UnreadCountResponse unreadCount() {
    return new UnreadCountResponse(
        notificationRepository.countByTenantIdAndRecipientInAndReadAtIsNull(
            TenantContext.current(), visibleRecipients()));
  }

  @Transactional
  public NotificationResponse markRead(String id) {
    PortalNotification notification =
        notificationRepository
            .findByIdAndTenantId(id, TenantContext.current())
            .filter(item -> visibleRecipients().contains(item.getRecipient()))
            .orElseThrow(() -> new ResourceNotFoundException("通知不存在：" + id));
    notification.markRead(Instant.now());
    return NotificationResponse.from(notification);
  }

  @Transactional
  public UnreadCountResponse markAllRead() {
    notificationRepository.markAllRead(TenantContext.current(), visibleRecipients(), Instant.now());
    return unreadCount();
  }

  private List<String> visibleRecipients() {
    return List.of(CurrentOperator.name(), PortalNotification.RECIPIENT_TENANT);
  }
}
