/**
 * 租户 store（M5 多租户）：组件侧读写当前租户的 Pinia 视图。
 * 实际状态与持久化在 src/tenant.ts 的响应式单例中（api 拦截器直接读取，避免循环依赖）。
 */
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { DEFAULT_TENANT, setTenant, tenantState } from '@/tenant'

export const useTenantStore = defineStore('tenant', () => {
  const tenantId = computed(() => tenantState.tenantId)

  /** 切换租户：非法值退回 default，返回实际生效的租户标识（调用方可判断是否被纠正）。 */
  function switchTenant(value: string): string {
    return setTenant(value)
  }

  return { tenantId, switchTenant, DEFAULT_TENANT }
})
