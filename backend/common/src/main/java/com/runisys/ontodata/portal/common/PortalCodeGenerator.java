package com.runisys.ontodata.portal.common;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * 门户域稳定编码生成器：{@code <prefix>-xxxxxxxx}（8 位十六进制随机值）。
 *
 * <p>审批单用 apr-、需求单用 req-、公告用 ntc-、反馈用 fb-；编码是跨软件契约的稳定引用 （MCP 网关把 R4
 * 确认卡升级为审批单时按编码回查；需求分派后目标软件按编码回链）， 生成后永不变更；唯一约束兜底随机碰撞。
 */
@Component
public class PortalCodeGenerator {

  private static final char[] HEX = "0123456789abcdef".toCharArray();

  private final SecureRandom random = new SecureRandom();

  public String nextCode(String prefix) {
    char[] suffix = new char[8];
    for (int index = 0; index < suffix.length; index++) {
      suffix[index] = HEX[random.nextInt(HEX.length)];
    }
    return prefix + "-" + new String(suffix);
  }
}
