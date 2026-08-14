/**
 * 租户上下文（M5 多租户前端基础）：与后端 TenantContext/TenantContextFilter 同构。
 *
 * - 合法租户标识与后端一致：小写字母/数字/连字符，1-64 位（`[a-z0-9-]{1,64}`）；
 * - 当前租户持久化到 localStorage，刷新后保持；不可用（隐私模式）时退回缺省租户；
 * - 独立于 Pinia 的响应式单例：api 拦截器直接读取，避免 store ↔ api 循环依赖。
 */
import { reactive } from 'vue'

export const TENANT_STORAGE_KEY = 'ontodata.tenant'
export const DEFAULT_TENANT = 'default'
export const TENANT_PATTERN = /^[a-z0-9-]{1,64}$/

export const tenantState = reactive({
  tenantId: loadTenant(),
})

/** 读取持久化租户：缺失或非法时退回缺省租户 default。 */
export function loadTenant(): string {
  try {
    const stored = window.localStorage.getItem(TENANT_STORAGE_KEY)
    if (stored && isValidTenant(stored)) {
      return stored
    }
  } catch {
    // localStorage 不可用时按缺省租户运行（仅影响持久化，不影响当前会话）
  }
  return DEFAULT_TENANT
}

/** 租户标识合法性校验（与后端过滤器的拒绝规则一致，前端先行拦截）。 */
export function isValidTenant(value: string): boolean {
  return TENANT_PATTERN.test(value)
}

/**
 * 切换当前租户：非法值退回缺省租户并返回实际生效值。
 * 持久化失败不影响当前会话（下一次刷新退回上次成功持久化的值）。
 */
export function setTenant(value: string): string {
  const normalized = value.trim()
  const next = normalized.length > 0 && isValidTenant(normalized) ? normalized : DEFAULT_TENANT
  tenantState.tenantId = next
  try {
    window.localStorage.setItem(TENANT_STORAGE_KEY, next)
  } catch {
    // 忽略持久化失败
  }
  return next
}
