package com.runisys.ontodata.portal.operationscenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.operationscenter.application.OperationsService;
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
 * 门户运营 REST 接口：公告（创建/发布/归档）、反馈（创建/处理）、运营统计。
 *
 * <p>公开公告列表默认只返回 PUBLISHED；带 status 参数的查询供管理端查看草稿与归档。
 */
@RestController
@RequestMapping("/api/v1/operations")
public class OperationsController {

  private final OperationsService operationsService;

  public OperationsController(OperationsService operationsService) {
    this.operationsService = operationsService;
  }

  // ---- 公告 ----

  @PostMapping("/notices")
  @ResponseStatus(HttpStatus.CREATED)
  public NoticeResponse createNotice(@Valid @RequestBody CreateNoticeRequest request) {
    return operationsService.createNotice(request);
  }

  @PostMapping("/notices/{code}/publish")
  public NoticeResponse publishNotice(@PathVariable String code) {
    return operationsService.publishNotice(code);
  }

  @PostMapping("/notices/{code}/archive")
  public NoticeResponse archiveNotice(@PathVariable String code) {
    return operationsService.archiveNotice(code);
  }

  @GetMapping("/notices/{code}")
  public NoticeResponse findNotice(@PathVariable String code) {
    return operationsService.findNotice(code);
  }

  @GetMapping("/notices")
  public PageResponse<NoticeResponse> listNotices(@Valid PageRequestParameters parameters) {
    return operationsService.listNotices(parameters);
  }

  // ---- 反馈 ----

  @PostMapping("/feedbacks")
  @ResponseStatus(HttpStatus.CREATED)
  public FeedbackResponse createFeedback(@Valid @RequestBody CreateFeedbackRequest request) {
    return operationsService.createFeedback(request);
  }

  @PostMapping("/feedbacks/{code}/handle")
  public FeedbackResponse handleFeedback(
      @PathVariable String code, @Valid @RequestBody HandleFeedbackRequest request) {
    return operationsService.handleFeedback(code, request.getHandleNote());
  }

  @GetMapping("/feedbacks/{code}")
  public FeedbackResponse findFeedback(@PathVariable String code) {
    return operationsService.findFeedback(code);
  }

  @GetMapping("/feedbacks")
  public PageResponse<FeedbackResponse> listFeedbacks(@Valid PageRequestParameters parameters) {
    return operationsService.listFeedbacks(parameters);
  }

  // ---- 运营统计 ----

  @GetMapping("/statistics")
  public OperationsStatisticsResponse statistics() {
    return operationsService.statistics();
  }
}
