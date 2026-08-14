package com.runisys.ontodata.portal.retentioncenter.api;

import java.time.Instant;

/** 数据保留状态：超过保留期的可清理终态记录统计（M5 数据保留）。 */
public class RetentionStatusResponse {

  private final int retentionDays;
  private final Instant cutoffAt;
  private final long tasks;
  private final long approvals;
  private final long requirements;
  private final long feedbacks;
  private final long notices;

  public RetentionStatusResponse(
      int retentionDays,
      Instant cutoffAt,
      long tasks,
      long approvals,
      long requirements,
      long feedbacks,
      long notices) {
    this.retentionDays = retentionDays;
    this.cutoffAt = cutoffAt;
    this.tasks = tasks;
    this.approvals = approvals;
    this.requirements = requirements;
    this.feedbacks = feedbacks;
    this.notices = notices;
  }

  public int getRetentionDays() {
    return retentionDays;
  }

  public Instant getCutoffAt() {
    return cutoffAt;
  }

  public long getTasks() {
    return tasks;
  }

  public long getApprovals() {
    return approvals;
  }

  public long getRequirements() {
    return requirements;
  }

  public long getFeedbacks() {
    return feedbacks;
  }

  public long getNotices() {
    return notices;
  }
}
