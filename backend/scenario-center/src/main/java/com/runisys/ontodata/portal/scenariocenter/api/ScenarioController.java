package com.runisys.ontodata.portal.scenariocenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.scenariocenter.application.ScenarioService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 场景编排 REST 接口（scenario/v1）：CRUD + 发布/下线状态机逐动作暴露。
 *
 * <p>钉扎校验在创建/更新时即执行（latest/通配符 400）；发布前 fail-closed 回查引用存在性 （引用失效/上游不可达 400 阻断发布）；已发布版本不可变（PUT
 * 409），修改走 POST /{code}/drafts 派生新草稿版本。
 */
@RestController
@RequestMapping("/api/v1/scenarios")
public class ScenarioController {

  private final ScenarioService scenarioService;

  public ScenarioController(ScenarioService scenarioService) {
    this.scenarioService = scenarioService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ScenarioResponse create(@Valid @RequestBody UpsertScenarioRequest request) {
    return scenarioService.create(request);
  }

  @PutMapping("/{code}/versions/{version}")
  public ScenarioResponse update(
      @PathVariable String code,
      @PathVariable String version,
      @Valid @RequestBody UpsertScenarioRequest request) {
    return scenarioService.update(code, version, request);
  }

  @PostMapping("/{code}/versions/{version}/publish")
  public ScenarioResponse publish(@PathVariable String code, @PathVariable String version) {
    return scenarioService.publish(code, version);
  }

  @PostMapping("/{code}/versions/{version}/deprecate")
  public ScenarioResponse deprecate(@PathVariable String code, @PathVariable String version) {
    return scenarioService.deprecate(code, version);
  }

  @PostMapping("/{code}/drafts")
  @ResponseStatus(HttpStatus.CREATED)
  public ScenarioResponse createDraft(@PathVariable String code) {
    return scenarioService.createDraft(code);
  }

  @GetMapping("/{code}")
  public ScenarioResponse find(@PathVariable String code) {
    return scenarioService.find(code);
  }

  @GetMapping("/{code}/versions/{version}")
  public ScenarioResponse findVersion(@PathVariable String code, @PathVariable String version) {
    return scenarioService.findVersion(code, version);
  }

  @GetMapping
  public PageResponse<ScenarioResponse> list(@Valid PageRequestParameters parameters) {
    return scenarioService.list(parameters);
  }
}
