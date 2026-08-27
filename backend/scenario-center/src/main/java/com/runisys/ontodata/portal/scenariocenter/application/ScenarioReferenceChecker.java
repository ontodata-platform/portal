package com.runisys.ontodata.portal.scenariocenter.application;

import com.runisys.ontodata.portal.scenariocenter.api.UpsertScenarioRequest.BindingRequest;
import java.util.List;

/**
 * 场景发布前引用存在性回查（scenario/v1 关键不变量 3：引用必须可解析）。
 *
 * <p>fail-closed：上游目录不可达/响应结构非法/引用不存在，一律抛 IllegalArgumentException 阻断发布， 绝不以桩结果放行（对齐 recombine 回查
 * transform 能力目录的既有模式）。 可配置宽松模式（ontodata.scenario.reference-check.enabled=false）整体跳过回查，仅供离线开发。
 */
public interface ScenarioReferenceChecker {

  /** 逐个校验绑定引用在权威源系统真实存在且状态可用；任一失效即抛错。 */
  void checkAll(List<BindingRequest> bindings);
}
