package com.runisys.ontodata.portal.retentioncenter.api;

import com.runisys.ontodata.portal.retentioncenter.application.RetentionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 数据保留接口（M5）：状态查询与清理。dryRun 默认 true（先演练后执行）， 只清理超过保留期的终态记录；结果引用与证据链不在清理范围。 */
@RestController
@RequestMapping("/api/v1/retention")
public class RetentionController {

  private final RetentionService retentionService;

  public RetentionController(RetentionService retentionService) {
    this.retentionService = retentionService;
  }

  @GetMapping("/status")
  public RetentionStatusResponse status() {
    return retentionService.status();
  }

  @PostMapping("/cleanup")
  public RetentionCleanupResponse cleanup(@RequestParam(defaultValue = "true") boolean dryRun) {
    return retentionService.cleanup(dryRun);
  }
}
