<script setup lang="ts">
/**
 * 门户权限矩阵（D5-3）：角色 × 资源勾选，保存后由路由守卫消费（IAM 开启语义）。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadPermissionMatrix, savePermissionMatrix, PORTAL_RESOURCES, type PermissionMatrixEntry } from '@/mocks/permissionMatrix'
import { useMessageStore } from '@/stores/message'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const messageStore = useMessageStore()

const matrix = ref<PermissionMatrixEntry[]>(loadPermissionMatrix())

function has(role: string, resource: string): boolean {
  return matrix.value.some((entry) => entry.role === role && entry.resources.includes(resource))
}

function toggle(role: string, resource: string): void {
  const entry = matrix.value.find((item) => item.role === role)
  if (!entry) return
  entry.resources = entry.resources.includes(resource)
    ? entry.resources.filter((item) => item !== resource)
    : [...entry.resources, resource]
}

function save(): void {
  savePermissionMatrix(matrix.value)
  messageStore.success(t('admin.iam.matrixSaved'))
}
</script>

<template>
  <div class="permission-matrix">
    <table class="matrix-table">
      <thead>
        <tr>
          <th>{{ t('admin.iam.matrixResource') }}</th>
          <th v-for="entry in matrix" :key="entry.role">{{ 中文展示(entry.role) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="resource in PORTAL_RESOURCES" :key="resource.key">
          <td>
            {{ resource.label }}
            <span class="cell-mono matrix-key">{{ resource.key }}</span>
          </td>
          <td v-for="entry in matrix" :key="`${entry.role}-${resource.key}`" class="matrix-cell">
            <a-checkbox :checked="has(entry.role, resource.key)" @change="() => toggle(entry.role, resource.key)" />
          </td>
        </tr>
      </tbody>
    </table>
    <a-button type="primary" style="margin-top: 12px" @click="save">{{ t('common.save') }}</a-button>
  </div>
</template>

<style scoped>
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.matrix-table th,
.matrix-table td {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  padding: 8px 10px;
  text-align: left;
}

.matrix-key {
  display: block;
  font-size: 10px;
  color: var(--od-gray-500, #64748b);
}

.matrix-cell {
  text-align: center;
}
</style>
