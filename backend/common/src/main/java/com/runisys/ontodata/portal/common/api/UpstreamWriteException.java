package com.runisys.ontodata.portal.common.api;

/**
 * 上游写调用失败（门户门面）：映射 502 UPSTREAM_FAILED，不得降级为 200。
 */
public class UpstreamWriteException extends RuntimeException {

  public UpstreamWriteException(String message) {
    super(message);
  }

  public UpstreamWriteException(String message, Throwable cause) {
    super(message, cause);
  }
}
