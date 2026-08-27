package com.runisys.ontodata.portal.approvalcenter.api;

/** 批量审批中单条失败原因。 */
public class BatchDecideFailure {

  private final String code;
  private final String message;

  public BatchDecideFailure(String code, String message) {
    this.code = code;
    this.message = message;
  }

  public String getCode() {
    return code;
  }

  public String getMessage() {
    return message;
  }
}
