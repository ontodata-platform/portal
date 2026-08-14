package com.runisys.ontodata.portal.operationscenter.api;

/** 运营统计视图：门户运营首页的简单聚合数字。 */
public class OperationsStatisticsResponse {

  private final long noticeTotal;
  private final long publishedNotices;
  private final long pendingFeedbacks;

  public OperationsStatisticsResponse(
      long noticeTotal, long publishedNotices, long pendingFeedbacks) {
    this.noticeTotal = noticeTotal;
    this.publishedNotices = publishedNotices;
    this.pendingFeedbacks = pendingFeedbacks;
  }

  public long getNoticeTotal() {
    return noticeTotal;
  }

  public long getPublishedNotices() {
    return publishedNotices;
  }

  public long getPendingFeedbacks() {
    return pendingFeedbacks;
  }
}
