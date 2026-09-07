<script setup lang="ts">
import { ExportOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { adminIamApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { AbacPolicy, IamUser } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const KEYCLOAK_CONSOLE = 'http://localhost:8180/admin/master/console/'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const users = ref<IamUser[]>([])
const policies = ref<AbacPolicy[]>([])
const keyword = ref('')

const matrixRows = computed(() => [
  { entry: t('admin.iam.matrixWorkbench'), roles: t('admin.iam.matrixWorkbenchRoles') },
  { entry: t('admin.iam.matrixAdmin'), roles: t('admin.iam.matrixAdminRoles') },
  { entry: t('admin.iam.matrixApproval'), roles: t('admin.iam.matrixApprovalRoles') },
  { entry: t('admin.iam.matrixR4'), roles: t('admin.iam.matrixR4Roles') },
])

const userColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name', width: 120 },
  { title: t('admin.iam.username'), dataIndex: 'username', key: 'username', width: 140 },
  { title: t('admin.iam.tenant'), dataIndex: 'tenantId', key: 'tenantId', width: 120 },
  { title: t('admin.iam.roles'), dataIndex: 'roles', key: 'roles' },
  { title: t('admin.iam.userStatus'), dataIndex: 'status', key: 'status', width: 100 },
])

const matrixColumns = computed(() => [
  { title: t('admin.iam.entry'), dataIndex: 'entry', key: 'entry' },
  { title: t('admin.iam.requiredRoles'), dataIndex: 'roles', key: 'roles' },
])

const policyColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name', width: 160 },
  { title: t('common.code'), dataIndex: 'resource', key: 'resource' },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110 },
  { title: t('admin.iam.roles'), dataIndex: 'roles', key: 'roles' },
])

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [userPage, policyPage] = await Promise.all([
      adminIamApi.users({ page: 1, size: 50, keyword: keyword.value || undefined }),
      adminIamApi.policies(),
    ])
    users.value = userPage.items
    policies.value = policyPage.items
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="iam-admin-view">
    <PageHeader :eyebrow="t('menu.admin')" :title="t('menu.adminIam')" />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <div v-else class="iam-body">
      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.users')">
        <div class="toolbar-area">
          <a-space>
            <a-input
              v-model:value="keyword"
              :placeholder="t('admin.iam.searchPlaceholder')"
              style="width: 240px"
              allow-clear
              @press-enter="load"
            />
            <a-button type="primary" @click="load">
              <template #icon><SearchOutlined /></template>
              {{ t('common.query') }}
            </a-button>
          </a-space>
        </div>

        <EmptyState v-if="!loading && users.length === 0" :title="t('admin.iam.users')" />
        <a-table
          v-else
          :columns="userColumns"
          :data-source="users"
          :loading="loading"
          row-key="id"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              {{ record.name }}
            </template>
            <template v-else-if="column.key === 'roles'">
              <a-space size="small" wrap>
                <a-tag v-for="role in record.roles" :key="role" color="blue">{{ role }}</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'ACTIVE' ? 'success' : 'default'">
                {{ record.status === 'ACTIVE' ? t('admin.iam.active') : t('admin.iam.disabled') }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </a-card>

      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.roleMatrix')">
        <a-table :columns="matrixColumns" :data-source="matrixRows" row-key="entry" :pagination="false" />
        <h3 class="sub-title">{{ t('admin.iam.policies') }}</h3>
        <a-table :columns="policyColumns" :data-source="policies" row-key="id" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'roles'">
              <a-space size="small" wrap>
                <a-tag v-for="role in record.roles" :key="role">{{ role }}</a-tag>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>

      <a-card :bordered="false" class="admin-card keycloak-card" :title="t('admin.iam.keycloakTitle')">
        <p class="keycloak-hint">{{ t('admin.iam.keycloakHint') }}</p>
        <a-button type="primary" :href="KEYCLOAK_CONSOLE" target="_blank">
          <template #icon><ExportOutlined /></template>
          {{ t('admin.iam.keycloakAction') }}
        </a-button>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.iam-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  margin-bottom: 16px;
}

.sub-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.keycloak-hint {
  margin: 0 0 12px;
  color: var(--od-gray-500, #64748b);
  line-height: 1.6;
}
</style>
