/**
 * 门户当前登录主体身份（M5/产品化对齐）：
 * 通过 GET /api/v1/personal/me 解析当前主体名称、所属租户、角色及开发模式标志。
 */
import { personalApi } from '@/api/portal'
import type { PortalIdentity } from '@/types/portal'

export const DEFAULT_IDENTITY: PortalIdentity = {
  name: 'dev-user',
  tenantId: 'default',
  roles: [],
  devMode: true,
}

export async function fetchCurrentIdentity(): Promise<PortalIdentity> {
  try {
    return await personalApi.me()
  } catch (error) {
    // 接口异常或未就绪时返回默认开发主体兜底
    console.warn('获取当前身份失败，使用默认主体:', error)
    return DEFAULT_IDENTITY
  }
}
