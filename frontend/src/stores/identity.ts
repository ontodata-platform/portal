import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { DEFAULT_IDENTITY, fetchCurrentIdentity } from '@/auth/identity'
import type { PortalIdentity } from '@/types/portal'

export const useIdentityStore = defineStore('identity', () => {
  const identity = ref<PortalIdentity>({ ...DEFAULT_IDENTITY })
  const loaded = ref(false)
  const loading = ref(false)

  const name = computed(() => identity.value.name)
  const tenantId = computed(() => identity.value.tenantId)
  const roles = computed(() => identity.value.roles)
  const devMode = computed(() => identity.value.devMode)

  /**
   * 门户运营权限判定：
   * devMode=true（开发模式/IAM关闭）时全开放；
   * IAM 开启时需具备 operator / admin / portal-operator / portal-admin 角色之一。
   */
  const canAccessOperations = computed(() => {
    if (identity.value.devMode) {
      return true
    }
    const targetRoles = ['portal-operator', 'portal-admin', 'operator', 'admin']
    return identity.value.roles.some((role) => targetRoles.includes(role))
  })

  function hasRole(role: string): boolean {
    return identity.value.roles.includes(role)
  }

  async function fetchIdentity() {
    loading.value = true
    try {
      const data = await fetchCurrentIdentity()
      identity.value = data
      loaded.value = true
      return data
    } finally {
      loading.value = false
    }
  }

  function setIdentity(newIdentity: PortalIdentity) {
    identity.value = { ...newIdentity }
    loaded.value = true
  }

  function reset() {
    identity.value = { ...DEFAULT_IDENTITY }
    loaded.value = false
  }

  return {
    identity,
    loaded,
    loading,
    name,
    tenantId,
    roles,
    devMode,
    canAccessOperations,
    hasRole,
    fetchIdentity,
    setIdentity,
    reset,
  }
})
