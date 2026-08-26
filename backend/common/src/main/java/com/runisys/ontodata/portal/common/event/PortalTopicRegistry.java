package com.runisys.ontodata.portal.common.event;

import com.runisys.ontodata.sdk.events.TopicRegistry;
import org.springframework.stereotype.Component;

/**
 * 门户域事件主题登记（ADR-006：{@code ontodata.<domain>.<aggregate>.v<major>}）。
 *
 * <p>原 EventTopics 静态映射收敛为 SDK {@link TopicRegistry} 的业务仓实现——
 * 域知识（哪些事件类型属于哪个主题）归业务系统所有，SDK 只定义契约。
 */
@Component
public class PortalTopicRegistry implements TopicRegistry {

  /** 门户审批域事件（R4 审批决定等）：ontodata.portal.approval.v1 */
  public static final String PORTAL_APPROVAL_V1 = "ontodata.portal.approval.v1";

  @Override
  public String forEventType(String eventType) {
    if (eventType.startsWith("portal.approval.")) {
      return PORTAL_APPROVAL_V1;
    }
    throw new IllegalArgumentException("事件类型未登记主题映射：" + eventType);
  }
}
