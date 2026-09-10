<script setup lang="ts">
import { EditOutlined, PoweroffOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { adminIamApi, approvalApi } from '@/api/portal'
import OrgTreeView from '@/components/iam/OrgTreeView.vue'
import PermissionMatrix from '@/components/iam/PermissionMatrix.vue'
import { useMessageStore } from '@/stores/message'
import type { AbacPolicy, IamAuditLog, IamRole, IamUser } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import TableFilterBar from '@/ui-kit/TableFilterBar.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const users = ref<IamUser[]>([])
const roles = ref<IamRole[]>([])
const policies = ref<AbacPolicy[]>([])
const auditLogs = ref<IamAuditLog[]>([])
const query = reactive({ keyword: '', status: '', role: '' })
const actionLoading = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({ name: '', username: '', tenantId: 'default', roles: [] as string[] })

async function createUser() {
  if (!createForm.name.trim() || !createForm.username.trim()) return
  creating.value = true
  try {
    await adminIamApi.createUser({ ...createForm })
    messageStore.success(t('admin.iam.userCreated'))
    createOpen.value = false
    createForm.name = ''
    createForm.username = ''
    createForm.roles = []
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    creating.value = false
  }
}

// D5-4：外部系统权限副本（分系统返回的非权威数据，演示固定三条）
const externalPermissions = [
  { user: '陈晓', system: '管理平台', role: '数据使用人', resource: '目录检索/订阅', expires: '2026-12-31', syncedAt: '2026-09-11 08:00' },
  { user: 'alice', system: '算法重组平台', role: '算法用户', resource: '已发布算法运行', expires: '2026-11-30', syncedAt: '2026-09-11 08:00' },
  { user: '王工', system: '管理平台', role: '数据使用人', resource: 'SAR 影像订阅', expires: '2026-10-31', syncedAt: '2026-09-10 20:00' },
]

async function requestPermission() {
  try {
    const created = await approvalApi.create({
      approvalType: 'SYSTEM_PERMISSION',
      sourceSystem: 'portal',
      sourceCode: 'role-operator',
      title: '运营角色开通申请（自助发起）',
    })
    messageStore.success(t('admin.iam.permissionRequested', { code: created.code }))
  } catch (error) {
    messageStore.reportError(error)
  }
}

const roleEditorOpen = ref(false)
const editingUser = ref<IamUser | null>(null)
const roleForm = reactive({ roles: [] as string[] })
const roleDrawerOpen = ref(false)
const inspectedRole = ref<IamRole | null>(null)

const activeUserCount = computed(() => users.value.filter((user) => user.status === 'ACTIVE').length)
const disabledUserCount = computed(() => users.value.filter((user) => user.status === 'DISABLED').length)
const roleOptions = computed(() => roles.value.map((role) => ({ value: role.code, label: 中文展示(role.code) })))
const userFilterSpecs = computed(() => [
  {
    key: 'status',
    label: t('common.status'),
    options: [
      { value: 'ACTIVE', label: t('admin.iam.active') },
      { value: 'DISABLED', label: t('admin.iam.disabled') },
    ],
  },
  { key: 'role', label: t('common.role'), options: roleOptions.value },
])
const effectiveRolePermissions = computed(() => [
  ...new Set(roles.value.filter((role) => roleForm.roles.includes(role.code)).flatMap((role) => role.permissions)),
])
const roleRows = computed(() => roles.value.map((role) => ({ ...role, memberCount: roleMembers(role.code).length })))

const userColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name', width: 120, odEllipsis: true, odSortable: true },
  { title: t('admin.iam.username'), dataIndex: 'username', key: 'username', width: 140, odEllipsis: true, odSortable: true, mono: true },
  { title: t('admin.iam.tenant'), dataIndex: 'tenantId', key: 'tenantId', width: 120, odEllipsis: true, odSortable: true, mono: true },
  { title: t('admin.iam.roles'), dataIndex: 'roles', key: 'roles', odEllipsis: true },
  { title: t('admin.iam.userStatus'), dataIndex: 'status', key: 'status', width: 96, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 184 },
])

const roleColumns = computed(() => [
  { title: t('admin.iam.role'), dataIndex: 'code', key: 'role', width: 170, odSortable: true },
  { title: t('admin.iam.roleDescription'), dataIndex: 'description', key: 'description', odEllipsis: true },
  { title: t('admin.iam.permissionCount'), dataIndex: 'permissions', key: 'permissions', width: 220 },
  { title: t('admin.iam.memberCount'), dataIndex: 'memberCount', key: 'members', width: 92, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 108 },
])

const policyColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name', width: 160, odEllipsis: true, odSortable: true },
  { title: t('common.code'), dataIndex: 'resource', key: 'resource', odEllipsis: true, odSortable: true, mono: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110, odEllipsis: true, odSortable: true },
  { title: t('admin.iam.roles'), dataIndex: 'roles', key: 'roles', odEllipsis: true },
])

const auditColumns = computed(() => [
  { title: t('admin.iam.auditAction'), dataIndex: 'action', key: 'action', width: 150, odEllipsis: true },
  { title: t('admin.iam.auditTarget'), dataIndex: 'targetName', key: 'targetName', width: 110, odEllipsis: true },
  { title: t('admin.iam.auditDetail'), dataIndex: 'detail', key: 'detail', odEllipsis: true },
  { title: t('admin.iam.auditOperator'), dataIndex: 'operator', key: 'operator', width: 100, odEllipsis: true },
  { title: t('admin.iam.auditTime'), dataIndex: 'createdAt', key: 'createdAt', width: 148, odSortable: true },
])

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function roleMembers(roleCode: string): IamUser[] {
  return users.value.filter((user) => user.roles.includes(roleCode))
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [userPage, roleResult, policyResult, auditResult] = await Promise.all([
      adminIamApi.users({
        page: 1,
        size: 50,
        keyword: query.keyword || undefined,
        status: query.status || undefined,
        role: query.role || undefined,
      }),
      adminIamApi.roles(),
      adminIamApi.policies(),
      adminIamApi.auditLogs(),
    ])
    users.value = userPage.items
    roles.value = roleResult.items
    policies.value = policyResult.items
    auditLogs.value = auditResult.items
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openRoleEditor(user: IamUser) {
  editingUser.value = user
  roleForm.roles = [...user.roles]
  roleEditorOpen.value = true
}

async function saveUserRoles() {
  if (!editingUser.value || roleForm.roles.length === 0) {
    messageStore.warning(t('admin.iam.roleRequired'))
    return
  }
  actionLoading.value = 'roles:' + editingUser.value.id
  try {
    await adminIamApi.updateUserRoles(editingUser.value.id, { roles: [...roleForm.roles] })
    messageStore.success(t('admin.iam.roleUpdated', { name: editingUser.value.name }))
    roleEditorOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    actionLoading.value = ''
  }
}

async function toggleUserStatus(user: IamUser) {
  const status: IamUser['status'] = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  actionLoading.value = 'status:' + user.id
  try {
    await adminIamApi.updateUserStatus(user.id, status)
    messageStore.success(t('admin.iam.statusUpdated', { status: status === 'ACTIVE' ? t('admin.iam.enable') : t('admin.iam.disable'), name: user.name }))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    actionLoading.value = ''
  }
}

function inspectRole(role: IamRole) {
  inspectedRole.value = role
  roleDrawerOpen.value = true
}

onMounted(load)
</script>

<template>
  <div class="iam-admin-view">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <div v-else class="iam-body">
      <section class="iam-overview" :aria-label="t('menu.adminIam')">
        <div class="iam-overview__item">
          <span>{{ t('admin.iam.active') }}{{ t('admin.iam.userCount') }}</span>
          <strong>{{ activeUserCount }}</strong>
        </div>
        <div class="iam-overview__item">
          <span>{{ t('admin.iam.disabled') }}{{ t('admin.iam.userCount') }}</span>
          <strong>{{ disabledUserCount }}</strong>
        </div>
        <div class="iam-overview__item">
          <span>{{ t('admin.iam.roles') }}</span>
          <strong>{{ roles.length }}</strong>
        </div>
        <div class="iam-overview__item">
          <span>{{ t('admin.iam.policies') }}</span>
          <strong>{{ policies.length }}</strong>
        </div>
      </section>

      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.users')">
        <template #extra>
          <a-button size="small" type="primary" @click="createOpen = true">{{ t('admin.iam.createUser') }}</a-button>
        </template>
        <div class="toolbar-area">
          <TableFilterBar
            :query="query"
            :filters="userFilterSpecs"
            :search-placeholder="t('admin.iam.searchPlaceholder')"
            :search-width="240"
            @update="Object.assign(query, $event)"
            @search="load"
          />
        </div>

        <EmptyState v-if="!loading && users.length === 0" :title="t('admin.iam.users')" />
        <OdTable
          v-else
          :columns="userColumns"
          :data-source="users"
          :loading="loading"
          row-key="id"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'roles'">
              <a-space size="small" wrap>
                <a-tag v-for="role in record.roles" :key="role" color="blue">{{ 中文展示(role) }}</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'ACTIVE' ? 'success' : 'default'">
                {{ record.status === 'ACTIVE' ? t('admin.iam.active') : t('admin.iam.disabled') }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small" wrap>
                <a-button size="small" @click="openRoleEditor(record)">
                  <template #icon><EditOutlined /></template>
                  {{ t('admin.iam.configureRoles') }}
                </a-button>
                <a-button
                  size="small"
                  :danger="record.status === 'ACTIVE'"
                  :loading="actionLoading === 'status:' + record.id"
                  @click="toggleUserStatus(record)"
                >
                  <template #icon><PoweroffOutlined /></template>
                  {{ record.status === 'ACTIVE' ? t('admin.iam.disable') : t('admin.iam.enable') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </OdTable>
      </a-card>

      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.rolePermissions')">
        <OdTable
          :columns="roleColumns"
          :data-source="roleRows"
          row-key="code"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <div class="role-name-cell">
                <strong>{{ 中文展示(record.code) }}</strong>
                <span class="cell-mono">{{ record.code }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'permissions'">
              <a-space size="small" wrap>
                <a-tag v-for="permission in (record.permissions ?? []).slice(0, 3)" :key="permission">{{ 中文展示(permission) }}</a-tag>
                <a-tag v-if="(record.permissions ?? []).length > 3">+{{ record.permissions.length - 3 }}</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'members'">{{ record.memberCount }} 人</template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" type="primary" ghost @click="inspectRole(record)">
                {{ t('admin.iam.viewPermissions') }}
              </a-button>
            </template>
          </template>
        </OdTable>
      </a-card>

      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.policies')">
        <p class="card-hint">{{ t('admin.iam.policyHint') }}</p>
        <OdTable :columns="policyColumns" :data-source="policies" row-key="id" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'roles'">
              <a-space size="small" wrap>
                <a-tag v-for="role in record.roles" :key="role">{{ 中文展示(role) }}</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'action'">{{ 中文展示(record.action) }}</template>
          </template>
        </OdTable>
      </a-card>

      <a-card :bordered="false" class="admin-card" :title="t('admin.iam.auditLogs')">
        <EmptyState v-if="!loading && auditLogs.length === 0" :title="t('admin.iam.noAuditLogs')" />
        <OdTable
          v-else
          :columns="auditColumns"
          :data-source="auditLogs"
          row-key="id"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">{{ 中文展示(record.action) }}</template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
          </template>
        </OdTable>
      </a-card>
    </div>

    <a-modal
      v-model:open="roleEditorOpen"
      :title="t('admin.iam.roleEditor')"
      :confirm-loading="actionLoading === 'roles:' + editingUser?.id"
      class="iam-user-role-modal"
      @ok="saveUserRoles"
    >
      <template v-if="editingUser">
        <p class="modal-hint">{{ t('admin.iam.roleEditorHint') }}</p>
        <a-form layout="vertical">
          <a-form-item :label="editingUser.name + ' · ' + editingUser.username" required>
            <a-checkbox-group v-model:value="roleForm.roles">
              <div class="role-select-grid">
                <a-checkbox v-for="role in roles" :key="role.code" :value="role.code">
                  <span class="role-checkbox-text">
                    <strong>{{ 中文展示(role.code) }}</strong>
                    <small>{{ role.description }}</small>
                  </span>
                </a-checkbox>
              </div>
            </a-checkbox-group>
          </a-form-item>
        </a-form>
        <div class="effective-permissions">
          <span>{{ t('admin.iam.effectivePermissions') }}</span>
          <a-space size="small" wrap>
            <a-tag v-for="permission in effectiveRolePermissions" :key="permission" color="blue">{{ 中文展示(permission) }}</a-tag>
          </a-space>
        </div>
      </template>
    </a-modal>

    <a-drawer v-model:open="roleDrawerOpen" :title="inspectedRole ? t('admin.iam.roleDetail') + '：' + 中文展示(inspectedRole.code) : ''" width="520">
      <template v-if="inspectedRole">
        <a-descriptions :column="1" size="small">
          <a-descriptions-item :label="t('admin.iam.role')">{{ 中文展示(inspectedRole.code) }}</a-descriptions-item>
          <a-descriptions-item :label="t('admin.iam.roleDescription')">{{ inspectedRole.description }}</a-descriptions-item>
          <a-descriptions-item :label="t('admin.iam.memberCount')">{{ roleMembers(inspectedRole.code).length }} 人</a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <h3 class="drawer-section-title">{{ t('admin.iam.grantedPermissions') }}</h3>
        <a-space size="small" wrap>
          <a-tag v-for="permission in inspectedRole.permissions" :key="permission" color="blue">{{ 中文展示(permission) }}</a-tag>
        </a-space>
        <h3 class="drawer-section-title">{{ t('admin.iam.roleMembers') }}</h3>
        <ul class="role-member-list">
          <li v-for="member in roleMembers(inspectedRole.code)" :key="member.id">
            <span>{{ member.name }}（{{ member.username }}）</span>
            <a-tag :color="member.status === 'ACTIVE' ? 'success' : 'default'">{{ member.status === 'ACTIVE' ? t('admin.iam.active') : t('admin.iam.disabled') }}</a-tag>
          </li>
        </ul>
      </template>
    </a-drawer>

    <!-- D5-1 新增用户 -->
    <a-modal v-model:open="createOpen" :title="t('admin.iam.createUser')" :confirm-loading="creating" @ok="createUser">
      <a-form layout="vertical">
        <a-form-item :label="t('common.name')" required>
          <a-input v-model:value="createForm.name" />
        </a-form-item>
        <a-form-item :label="t('admin.iam.username')" required>
          <a-input v-model:value="createForm.username" />
        </a-form-item>
        <a-form-item :label="t('common.role')">
          <a-select v-model:value="createForm.roles" mode="multiple" :options="roleOptions" allow-clear />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- D5-2 组织管理 -->
    <a-card :bordered="false" class="admin-card" :title="t('admin.iam.orgTitle')">
      <OrgTreeView />
    </a-card>

    <!-- D5-3 门户权限矩阵（路由守卫消费） -->
    <a-card :bordered="false" class="admin-card" :title="t('admin.iam.matrixTitle')">
      <PermissionMatrix />
    </a-card>

    <!-- D5-4 外部系统权限副本（只读） + 权限申请 -->
    <a-card :bordered="false" class="admin-card" :title="t('admin.iam.externalTitle')">
      <template #extra>
        <a-button size="small" type="primary" @click="requestPermission">{{ t('admin.iam.requestPermission') }}</a-button>
      </template>
      <table class="external-table">
        <thead>
          <tr>
            <th>{{ t('common.applicant') }}</th>
            <th>{{ t('personal.profileTab.externalCopy') }}</th>
            <th>{{ t('common.role') }}</th>
            <th>{{ t('admin.iam.externalResource') }}</th>
            <th>{{ t('personal.profileTab.expires') }}</th>
            <th>{{ t('personal.profileTab.syncedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in externalPermissions" :key="`${item.user}-${item.system}-${item.resource}`">
            <td>{{ item.user }}</td>
            <td>{{ item.system }}</td>
            <td>{{ item.role }}</td>
            <td>{{ item.resource }}</td>
            <td>{{ item.expires }}</td>
            <td class="cell-mono">{{ item.syncedAt }}</td>
          </tr>
        </tbody>
      </table>
    </a-card>
  </div>
</template>

<style scoped>
.iam-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.iam-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.75rem;
}

.iam-overview__item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.875rem 1rem;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 0.75rem);
  background: var(--od-surface, #fff);
  box-shadow: var(--od-shadow-xs);
}

.iam-overview__item span,
.card-hint,
.modal-hint,
.role-name-cell span,
.role-checkbox-text small {
  color: var(--od-gray-500, #64748b);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.iam-overview__item strong {
  color: var(--od-gray-900, #0f172a);
  font-family: var(--od-font-mono, monospace);
  font-size: 1.5rem;
  line-height: 1.25;
}

.admin-card {
  border-radius: var(--od-radius-card, 0.75rem);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  margin-bottom: 1rem;
}

.card-hint,
.modal-hint {
  margin: 0 0 1rem;
}

.role-name-cell,
.role-checkbox-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.role-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.75rem;
}

.role-select-grid :deep(.ant-checkbox-wrapper) {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  margin-inline-start: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 0.5rem;
}

.effective-permissions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--od-primary-50, #eff6ff);
}

.effective-permissions > span {
  color: var(--od-gray-700, #334155);
  font-size: 0.8125rem;
  font-weight: 600;
}

.drawer-section-title {
  margin: 1.25rem 0 0.75rem;
  color: var(--od-gray-800, #1e293b);
  font-size: 0.875rem;
}

.role-member-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.role-member-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 0.5rem;
}

@media (max-width: 48rem) {
  .iam-overview,
  .role-select-grid {
    grid-template-columns: 1fr;
  }
}

.external-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.external-table th,
.external-table td {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  padding: 6px 10px;
  text-align: left;
}
</style>
