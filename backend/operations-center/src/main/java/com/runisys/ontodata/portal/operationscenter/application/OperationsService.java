package com.runisys.ontodata.portal.operationscenter.application;

import com.runisys.ontodata.portal.common.PortalIdentityService;
import com.runisys.ontodata.portal.common.TenantContext;
import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.common.api.ResourceNotFoundException;
import com.runisys.ontodata.portal.common.api.ResourceStateConflictException;
import com.runisys.ontodata.portal.operationscenter.api.CreateFeedbackRequest;
import com.runisys.ontodata.portal.operationscenter.api.CreateNoticeRequest;
import com.runisys.ontodata.portal.operationscenter.api.FeedbackResponse;
import com.runisys.ontodata.portal.operationscenter.api.NoticeResponse;
import com.runisys.ontodata.portal.operationscenter.api.OperationsStatisticsResponse;
import com.runisys.ontodata.portal.operationscenter.domain.Feedback;
import com.runisys.ontodata.portal.operationscenter.domain.Notice;
import com.runisys.ontodata.portal.operationscenter.infrastructure.FeedbackRepository;
import com.runisys.ontodata.portal.operationscenter.infrastructure.NoticeRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 门户运营服务：公告（ntc-*）发布/归档、反馈（fb-*）处理、运营统计。
 *
 * <p>不变量：公告单向流转 DRAFT → PUBLISHED → ARCHIVED（草稿不在公开列表出现，公开列表 默认只返回 PUBLISHED）；反馈 PENDING → HANDLED
 * 且处理说明必填；终态防重 409。
 */
@Service
public class OperationsService {

  private static final Map<String, String> SORT_FIELDS;

  static {
    Map<String, String> fields = new java.util.LinkedHashMap<String, String>();
    fields.put("updatedAt", "updatedAt");
    fields.put("publishedAt", "publishedAt");
    fields.put("code", "code");
    SORT_FIELDS = java.util.Collections.unmodifiableMap(fields);
  }

  private final NoticeRepository noticeRepository;
  private final FeedbackRepository feedbackRepository;
  private final PortalIdentityService identityService;

  public OperationsService(
      NoticeRepository noticeRepository,
      FeedbackRepository feedbackRepository,
      PortalIdentityService identityService) {
    this.noticeRepository = noticeRepository;
    this.feedbackRepository = feedbackRepository;
    this.identityService = identityService;
  }

  // ---- 公告 ----

  @Transactional
  public NoticeResponse createNotice(CreateNoticeRequest request) {
    Notice created =
        noticeRepository.saveAndFlush(
            new Notice(
                identityService.nextCode("ntc"),
                request.getTitle().trim(),
                request.getContent().trim(),
                request.getSection().trim(),
                TenantContext.current(),
                Instant.now()));
    return NoticeResponse.from(created);
  }

  @Transactional
  public NoticeResponse publishNotice(String code) {
    Notice notice = requireNotice(code);
    if (!Notice.STATUS_DRAFT.equals(notice.getStatus())) {
      throw new ResourceStateConflictException("仅草稿公告可以发布，当前状态：" + notice.getStatus());
    }
    notice.publish(Instant.now());
    return NoticeResponse.from(notice);
  }

  @Transactional
  public NoticeResponse archiveNotice(String code) {
    Notice notice = requireNotice(code);
    if (!Notice.STATUS_PUBLISHED.equals(notice.getStatus())) {
      throw new ResourceStateConflictException("仅已发布公告可以归档，当前状态：" + notice.getStatus());
    }
    notice.archive(Instant.now());
    return NoticeResponse.from(notice);
  }

  @Transactional(readOnly = true)
  public NoticeResponse findNotice(String code) {
    return NoticeResponse.from(requireNotice(code));
  }

  /** 公开列表默认只返回 PUBLISHED；管理查询可显式带 status 查看草稿与归档。 */
  @Transactional(readOnly = true)
  public PageResponse<NoticeResponse> listNotices(PageRequestParameters parameters) {
    List<Specification<Notice>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    String status =
        parameters.getStatus() == null ? Notice.STATUS_PUBLISHED : parameters.getStatus();
    predicates.add((root, query, builder) -> builder.equal(root.get("status"), status));
    if (parameters.getDomain() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("section"), parameters.getDomain()));
    }
    if (parameters.getKeyword() != null) {
      String pattern = "%" + parameters.getKeyword() + "%";
      predicates.add((root, query, builder) -> builder.like(root.get("title"), pattern));
    }
    Specification<Notice> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<Notice> page =
        noticeRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "publishedAt"));
    return PageResponse.map(page, NoticeResponse::from);
  }

  // ---- 反馈 ----

  @Transactional
  public FeedbackResponse createFeedback(CreateFeedbackRequest request) {
    Feedback created =
        feedbackRepository.saveAndFlush(
            new Feedback(
                identityService.nextCode("fb"),
                request.getTitle().trim(),
                request.getContent().trim(),
                trimToNull(request.getContact()),
                TenantContext.current(),
                Instant.now()));
    return FeedbackResponse.from(created);
  }

  @Transactional
  public FeedbackResponse handleFeedback(String code, String handleNote) {
    String note = trimToNull(handleNote);
    if (note == null) {
      throw new IllegalArgumentException("处理反馈必须填写处理说明");
    }
    Feedback feedback = requireFeedback(code);
    if (!Feedback.STATUS_PENDING.equals(feedback.getStatus())) {
      throw new ResourceStateConflictException("反馈已处理，不允许重复处理（当前状态：" + feedback.getStatus() + "）");
    }
    feedback.handle(note, Instant.now());
    return FeedbackResponse.from(feedback);
  }

  @Transactional(readOnly = true)
  public FeedbackResponse findFeedback(String code) {
    return FeedbackResponse.from(requireFeedback(code));
  }

  @Transactional(readOnly = true)
  public PageResponse<FeedbackResponse> listFeedbacks(PageRequestParameters parameters) {
    List<Specification<Feedback>> predicates = new ArrayList<>();
    // M5 多租户：列表按请求租户隔离
    predicates.add(
        (root, query, builder) -> builder.equal(root.get("tenantId"), TenantContext.current()));
    if (parameters.getStatus() != null) {
      predicates.add(
          (root, query, builder) -> builder.equal(root.get("status"), parameters.getStatus()));
    }
    if (parameters.getKeyword() != null) {
      String pattern = "%" + parameters.getKeyword() + "%";
      predicates.add((root, query, builder) -> builder.like(root.get("title"), pattern));
    }
    Specification<Feedback> combined =
        predicates.stream().reduce(Specification.where(null), Specification::and);
    Page<Feedback> page =
        feedbackRepository.findAll(combined, parameters.toPageable(SORT_FIELDS, "updatedAt"));
    return PageResponse.map(page, FeedbackResponse::from);
  }

  // ---- 运营统计 ----

  /** 统计按请求租户隔离（M5）：各租户只看到本租户的公告/反馈数量。 */
  @Transactional(readOnly = true)
  public OperationsStatisticsResponse statistics() {
    String tenantId = TenantContext.current();
    return new OperationsStatisticsResponse(
        noticeRepository.countByTenantId(tenantId),
        noticeRepository.countByStatusAndTenantId(Notice.STATUS_PUBLISHED, tenantId),
        feedbackRepository.countByStatusAndTenantId(Feedback.STATUS_PENDING, tenantId));
  }

  private Notice requireNotice(String code) {
    return noticeRepository
        .findByCodeAndTenantId(code, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("公告不存在：" + code));
  }

  private Feedback requireFeedback(String code) {
    return feedbackRepository
        .findByCodeAndTenantId(code, TenantContext.current())
        .orElseThrow(() -> new ResourceNotFoundException("反馈不存在：" + code));
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }
}
