package com.runisys.ontodata.portal.taskcenter.api;

import com.runisys.ontodata.portal.taskcenter.application.ProjectionRebuildService;
import com.runisys.ontodata.portal.taskcenter.application.ProjectionRebuildService.RebuildSummary;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 投影管理端点（WP-03 / EVT-02）：任务投影的重放重建。
 *
 * <p><b>操作前提：</b>事件总线已启用且 broker 可达；主题保留期覆盖需重建的历史窗口 （ADR-006 建议 ≥30 天）；建议在维护窗口执行——重建会先清空
 * portal_task，投影在重放 追平前处于部分恢复状态，任务中心读到的是不完整视图。
 *
 * <p><b>影响：</b>正常消费组 {@code portal.task-projection} 位点不受影响；重建用一次性消费组 {@code
 * portal.task-projection-rebuild-<timestamp>} 从头订阅全部主题，复用 inbox 幂等 + 乱序防护路径；同时只允许一个重建（重复触发 409）。
 *
 * <p><b>安全：</b>本端点不在任何放行白名单内——安全模式（默认）下必须携带有效 OIDC Bearer 令牌（SecurityConfiguration.secureChain 的
 * anyRequest().authenticated() 覆盖）；仅显式 开发模式（ontodata.security.oauth2.enabled=false，严禁生产）下匿名可达。
 */
@RestController
@RequestMapping("/api/v1/projections")
public class ProjectionRebuildController {

  private final ProjectionRebuildService rebuildService;

  public ProjectionRebuildController(ProjectionRebuildService rebuildService) {
    this.rebuildService = rebuildService;
  }

  /**
   * 清空任务投影并从事件流整体重放重建。
   *
   * <p>同步执行：重放期间请求保持挂起（上限见 ProjectionRebuildService 的超时兜底），
   * 响应体为本次重放的统计（轮询/应用/去重/乱序丢弃/未知类型计数与投影行数），供运维核对。
   */
  @PostMapping("/rebuild")
  public RebuildSummary rebuild() {
    return rebuildService.rebuild();
  }
}
