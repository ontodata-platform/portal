package com.runisys.ontodata.portal.retentioncenter.api;

/** 清理结果：dryRun 时不删除只返回统计（审计安全，先演练后执行）。 */
public class RetentionCleanupResponse {

  private final boolean dryRun;
  private final long tasks;
  private final long approvals;
  private final long requirements;
  private final long feedbacks;
  private final long notices;

  public RetentionCleanupResponse(
      boolean dryRun, long tasks, long approvals, long requirements, long feedbacks, long notices) {
    this.dryRun = dryRun;
    this.tasks = tasks;
    this.approvals = approvals;
    this.requirements = requirements;
    this.feedbacks = feedbacks;
    this.notices = notices;
  }

  public boolean isDryRun() {
    return dryRun;
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
