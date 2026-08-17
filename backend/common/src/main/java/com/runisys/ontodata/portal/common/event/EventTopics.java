package com.runisys.ontodata.portal.common.event;

/**
 * 门户事件主题登记（ADR-006：{@code ontodata.<domain>.<aggregate>.v<major>}）。
 *
 * <p>主题主版本与信封 schemaVersion 主版本对齐；破坏性载荷变更必须开新主题。 新事件类型接入时必须在此登记映射，未登记的类型在 record 时直接拒绝（宁可失败也不发错主题）。
 */
public final class EventTopics {

  /** 审批域事件（审批决定 portal.approval.decided 等）：ontodata.portal.approval.v1 */
  public static final String PORTAL_APPROVAL_V1 = "ontodata.portal.approval.v1";

  private EventTopics() {}

  /** 按事件类型前缀解析目标主题；未登记的类型抛出异常，防止事件被投递到错误主题。 */
  public static String forEventType(String eventType) {
    if (eventType.startsWith("portal.approval.")) {
      return PORTAL_APPROVAL_V1;
    }
    throw new IllegalArgumentException("事件类型未登记主题映射：" + eventType);
  }
}
