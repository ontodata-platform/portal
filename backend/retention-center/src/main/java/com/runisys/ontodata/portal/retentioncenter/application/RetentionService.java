package com.runisys.ontodata.portal.retentioncenter.application;

import com.runisys.ontodata.portal.approvalcenter.domain.ApprovalRequest;
import com.runisys.ontodata.portal.approvalcenter.infrastructure.ApprovalRequestRepository;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.operationscenter.domain.Feedback;
import com.runisys.ontodata.portal.operationscenter.domain.Notice;
import com.runisys.ontodata.portal.operationscenter.infrastructure.FeedbackRepository;
import com.runisys.ontodata.portal.operationscenter.infrastructure.NoticeRepository;
import com.runisys.ontodata.portal.requirementcenter.domain.RequirementRequest;
import com.runisys.ontodata.portal.requirementcenter.infrastructure.RequirementRequestRepository;
import com.runisys.ontodata.portal.retentioncenter.api.RetentionCleanupResponse;
import com.runisys.ontodata.portal.retentioncenter.api.RetentionStatusResponse;
import com.runisys.ontodata.portal.taskcenter.infrastructure.PortalTaskRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 数据保留服务（M5）：只清理超过保留期的**终态**记录——非终态数据永不清理； 结果引用（可追踪率 100%）不在清理范围（结果中心结果与证据链保留，归档另策）。
 *
 * <p>安全语义：dryRun 先演练后执行；清理按中心独立计数且租户隔离，缺省保留 180 天 （ontodata.retention.days 可配置）。
 */
@Service
public class RetentionService {

  /** 任务终态：SUCCESS/FAILED/CANCELED（PENDING/RUNNING 永不清理）。 */
  private static final Set<String> TASK_TERMINAL = Set.of("SUCCESS", "FAILED", "CANCELED");

  private static final Set<String> APPROVAL_TERMINAL =
      Set.of(ApprovalRequest.STATUS_APPROVED, ApprovalRequest.STATUS_REJECTED);
  private static final Set<String> REQUIREMENT_TERMINAL =
      Set.of(RequirementRequest.STATUS_COMPLETED, RequirementRequest.STATUS_CANCELED);

  private final PortalTaskRepository taskRepository;
  private final ApprovalRequestRepository approvalRepository;
  private final RequirementRequestRepository requirementRepository;
  private final FeedbackRepository feedbackRepository;
  private final NoticeRepository noticeRepository;
  private final int retentionDays;

  public RetentionService(
      PortalTaskRepository taskRepository,
      ApprovalRequestRepository approvalRepository,
      RequirementRequestRepository requirementRepository,
      FeedbackRepository feedbackRepository,
      NoticeRepository noticeRepository,
      @Value("${ontodata.retention.days:180}") int retentionDays) {
    this.taskRepository = taskRepository;
    this.approvalRepository = approvalRepository;
    this.requirementRepository = requirementRepository;
    this.feedbackRepository = feedbackRepository;
    this.noticeRepository = noticeRepository;
    this.retentionDays = retentionDays;
  }

  @Transactional(readOnly = true)
  public RetentionStatusResponse status() {
    Instant cutoff = cutoff();
    String tenantId = TenantContext.current();
    return new RetentionStatusResponse(
        retentionDays,
        cutoff,
        taskRepository.countTerminalOlderThan(TASK_TERMINAL, cutoff, tenantId),
        approvalRepository.countTerminalOlderThan(APPROVAL_TERMINAL, cutoff, tenantId),
        requirementRepository.countTerminalOlderThan(REQUIREMENT_TERMINAL, cutoff, tenantId),
        feedbackRepository.countTerminalOlderThan(
            Set.of(Feedback.STATUS_HANDLED), cutoff, tenantId),
        noticeRepository.countTerminalOlderThan(Set.of(Notice.STATUS_ARCHIVED), cutoff, tenantId));
  }

  /** 清理：dryRun 只统计不删除；真实清理返回各中心删除条数（租户隔离）。 */
  @Transactional
  public RetentionCleanupResponse cleanup(boolean dryRun) {
    Instant cutoff = cutoff();
    String tenantId = TenantContext.current();
    long tasks = taskRepository.countTerminalOlderThan(TASK_TERMINAL, cutoff, tenantId);
    long approvals = approvalRepository.countTerminalOlderThan(APPROVAL_TERMINAL, cutoff, tenantId);
    long requirements =
        requirementRepository.countTerminalOlderThan(REQUIREMENT_TERMINAL, cutoff, tenantId);
    long feedbacks =
        feedbackRepository.countTerminalOlderThan(
            Set.of(Feedback.STATUS_HANDLED), cutoff, tenantId);
    long notices =
        noticeRepository.countTerminalOlderThan(Set.of(Notice.STATUS_ARCHIVED), cutoff, tenantId);
    if (!dryRun) {
      taskRepository.deleteTerminalOlderThan(TASK_TERMINAL, cutoff, tenantId);
      approvalRepository.deleteTerminalOlderThan(APPROVAL_TERMINAL, cutoff, tenantId);
      requirementRepository.deleteTerminalOlderThan(REQUIREMENT_TERMINAL, cutoff, tenantId);
      feedbackRepository.deleteTerminalOlderThan(Set.of(Feedback.STATUS_HANDLED), cutoff, tenantId);
      noticeRepository.deleteTerminalOlderThan(Set.of(Notice.STATUS_ARCHIVED), cutoff, tenantId);
    }
    return new RetentionCleanupResponse(dryRun, tasks, approvals, requirements, feedbacks, notices);
  }

  private Instant cutoff() {
    return Instant.now().minus(retentionDays, ChronoUnit.DAYS);
  }
}
