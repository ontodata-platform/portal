package com.runisys.ontodata.portal.common.security;

/**
 * 数据密级（M5 ABAC 基础）：PUBLIC < INTERNAL < CONFIDENTIAL < SECRET。
 *
 * <p>rank 用于比较（subject 许可密级必须 ≥ 资源密级）；字符串解析严格限定四种取值， 非法值抛中文 IllegalArgumentException（由
 * GlobalExceptionHandler 归一为 400）。
 */
public enum DataClassification {
  PUBLIC(0),
  INTERNAL(1),
  CONFIDENTIAL(2),
  SECRET(3);

  private final int rank;

  DataClassification(int rank) {
    this.rank = rank;
  }

  public int rank() {
    return rank;
  }

  /** 解析密级字符串：空值按 PUBLIC（登记缺省）；大小写不敏感；非法值 400。 */
  public static DataClassification fromString(String value) {
    if (value == null || value.isBlank()) {
      return PUBLIC;
    }
    try {
      return valueOf(value.trim().toUpperCase());
    } catch (IllegalArgumentException invalid) {
      throw new IllegalArgumentException("数据密级必须是 PUBLIC/INTERNAL/CONFIDENTIAL/SECRET 之一");
    }
  }
}
