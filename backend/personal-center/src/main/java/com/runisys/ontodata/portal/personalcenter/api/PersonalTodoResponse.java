package com.runisys.ontodata.portal.personalcenter.api;

/** 个人中心待办统计：首页卡片数字（各中心本地聚合，权威数据仍在各中心）。 */
public class PersonalTodoResponse {

  private final long pendingApprovalCount;
  private final long myOpenRequirementCount;
  private final long myRequirementCount;
  private final long myApprovalCount;

  public PersonalTodoResponse(
      long pendingApprovalCount,
      long myOpenRequirementCount,
      long myRequirementCount,
      long myApprovalCount) {
    this.pendingApprovalCount = pendingApprovalCount;
    this.myOpenRequirementCount = myOpenRequirementCount;
    this.myRequirementCount = myRequirementCount;
    this.myApprovalCount = myApprovalCount;
  }

  public long getPendingApprovalCount() {
    return pendingApprovalCount;
  }

  public long getMyOpenRequirementCount() {
    return myOpenRequirementCount;
  }

  public long getMyRequirementCount() {
    return myRequirementCount;
  }

  public long getMyApprovalCount() {
    return myApprovalCount;
  }
}
