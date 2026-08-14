package com.runisys.ontodata.portal.resultcenter.api;

import com.runisys.ontodata.portal.common.api.PageRequestParameters;
import com.runisys.ontodata.portal.common.api.PageResponse;
import com.runisys.ontodata.portal.resultcenter.application.ResultService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 结果中心 REST 接口。
 *
 * <p>PUT /results/{sourceSystem}/{resultId} 幂等登记：来源系统与结果标识放在路径， 从协议上保证可追踪率
 * 100%（§13.4，缺来源信息无法调用登记接口）。
 */
@RestController
@RequestMapping("/api/v1/results")
@Validated
public class ResultController {

  private final ResultService resultService;

  public ResultController(ResultService resultService) {
    this.resultService = resultService;
  }

  @PutMapping("/{sourceSystem}/{resultId}")
  @ResponseStatus(HttpStatus.OK)
  public PortalResultResponse register(
      @PathVariable @Pattern(regexp = "[a-z][a-z0-9\\-]{0,31}", message = "来源系统格式不正确")
          String sourceSystem,
      @PathVariable @Size(max = 128, message = "结果标识不能超过 128 个字符") String resultId,
      @Valid @RequestBody RegisterPortalResultRequest request) {
    return resultService.register(sourceSystem, resultId, request);
  }

  @GetMapping("/{sourceSystem}/{resultId}")
  public PortalResultResponse find(
      @PathVariable String sourceSystem, @PathVariable String resultId) {
    return resultService.find(sourceSystem, resultId);
  }

  @GetMapping
  public PageResponse<PortalResultResponse> list(@Valid PageRequestParameters parameters) {
    return resultService.list(parameters);
  }
}
