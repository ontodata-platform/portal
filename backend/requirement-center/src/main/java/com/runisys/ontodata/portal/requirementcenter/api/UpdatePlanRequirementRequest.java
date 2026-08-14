package com.runisys.ontodata.portal.requirementcenter.api;

import java.util.Map;

/** 需求计划更新请求：分派前可调整计划。 */
public class UpdatePlanRequirementRequest {

  private Map<String, Object> plan;

  public Map<String, Object> getPlan() {
    return plan;
  }

  public void setPlan(Map<String, Object> plan) {
    this.plan = plan;
  }
}
