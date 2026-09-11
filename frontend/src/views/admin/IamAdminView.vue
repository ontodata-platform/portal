<script setup lang="ts">
/**
 * 用户与权限（用户反馈重构）：按 用户→角色→权限 三层模型组织。
 * Tab 分组：用户（绑定角色）/ 角色（绑定权限，可增删改）/ 权限（页面访问 + 操作两类字典，
 * 含访问策略与外部系统权限副本）/ 组织（部门树）。
 */
import {
  DeleteOutlined,
  EditOutlined,
  PoweroffOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { adminIamApi, approvalApi } from '@/api/portal'
import { ACCESS_PERMISSIONS, OPERATION_PERMISSIONS, permissionLabel } from '@/constants/permissions'
import OrgTreeView from '@/components/iam/OrgTreeView.vue'
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

// ── 签页状态 ──
const activeTab = ref('users')

// D5-4：外部系统权限副本（分系统返回的非权威数据，演示固定三条）
const externalPermissions = [
  { user: '陈晓', system: '管理平台', role: '数据使用人', resource: '目录检索/订阅', expires: '2026-12-31', syncedAt: '2026-09-11 08:00' },
  { user: 'alice', system: '算法重组平台', role: '算法用户', resource: '已发布算法运行', expires: '2026-11-30', syncedAt: '2026-09-11 08:00' },
  { user: '王工', system: '管理平台', role: '数据使用人', resource: 'SAR 影像订阅', expires: '2026-10-31', syncedAt: '2026-09-10 20:00' },
]

// ── 角色 CRUD（D5 / 用户反馈：角色可新增编辑删除） ──
const roleCreateOpen = ref(false)
const roleCreating = ref(false)
const roleCreateForm = reactive({ code: '', name: '', description: '' })

const rolePermOpen = ref(false)
const rolePermCode = ref('')
const rolePermName = ref('')
const rolePermDraft = ref<string[]>([])
const rolePermSaving = ref(false)

const roleQuery = reactive({ keyword: '' })

// 角色查询：按名称/编码即时过滤
const visibleRoleRows = computed(() =>
  roleRows.value.filter((row) => {
    if (!roleQuery.keyword.trim()) return true
    const keyword = roleQuery.keyword.trim().toLowerCase()
    return `${row.name} ${row.code}`.toLowerCase().includes(keyword)
  }),
)

const roleMembers = (roleCode: string): IamUser[] =>
  users.value.filter((user) => user.roles.includes(roleCode))

function openRoleCreate() {
  roleCreateForm.code = ''
  roleCreateForm.name = ''
  roleCreateForm.description = ''
  roleCreateOpen.value = true
}

async function submitRoleCreate() {
  if (!roleCreateForm.code.trim() || !roleCreateForm.name.trim()) {
    messageStore.warning(t('admin.iam.roleFormIncomplete'))
    return
  }
  roleCreating.value = true
  try {
    await adminIamApi.createRole({
      code: roleCreateForm.code.trim(),
      name: roleCreateForm.name.trim(),
      description: roleCreateForm.description,
      permissions: [],
    })
    messageStore.success(t('admin.iam.roleCreated', { name: roleCreateForm.name }))
    roleCreateOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    roleCreating.value = false
  }
}

async function deleteRole(role: IamRole) {
  const members = roleMembers(role.code)
  if (members.length > 0) {
    messageStore.warning(t('admin.iam.roleDeleteBlocked', { count: members.length }))
    return
  }
  try {
    await adminIamApi.deleteRole(role.code)
    messageStore.success(t('admin.iam.roleDeleted', { name: 中文展示(role.code) }))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  }
}

// ── 角色权限绑定抽屉（角色 → 权限） ──
function openRolePermEditor(role: IamRole) {
  rolePermCode.value = role.code
  rolePermName.value = 中文展示(role.code)
  rolePermDraft.value = [...(role.permissions ?? [])]
  rolePermOpen.value = true
}

async function saveRolePermissions() {
  rolePermSaving.value = true
  try {
    await adminIamApi.updateRole(rolePermCode.value, { permissions: [...rolePermDraft.value] })
    messageStore.success(t('admin.iam.rolePermSaved', { name: rolePermName.value }))
    rolePermOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    rolePermSaving.value = false
  }
}

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

// ── 用户 ──
const editingUser = ref<IamUser | null>(null)
const roleEditorOpen = ref(false)
const roleForm = reactive({ roles: [] as string[] })
const roleDrawerOpen = ref(false)
const inspectedRole = ref<IamRole | null>(null)

const activeUserCount = computed(() => users.value.filter((user) => user.status === 'ACTIVE').length)
const disabledUserCount = computed(() => users.value.filter((user) => user.status === 'DISABLED').length)
const roleOptions = computed(() =>
  roles.value.map((role) => ({ value: role.code, label: role.name || 中文展示(role.code) })),
)
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
const roleRows = computed(() =>
  roles.value.map((role) => ({ ...role, memberCount: roleMembers(role.code).length })),
)

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
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 200 },
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

function roleMembersByCode(roleCode: string): IamUser[] {
  return users.value.filter((user) => user.roles.includes(roleCode))
}

/** 权限被哪些角色绑定（权限字典反查视图）。 */
function rolesOfPermission(key: string): string[] {
  return roles.value.filter((role) => (role.permissions ?? []).includes(key)).map((role) => role.name || 中文展示(role.code))
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

      <a-tabs v-model:active-key="activeTab" class="iam-tabs">
        <!-- ═══ 用户：用户绑定角色 ═══ -->
        <a-tab-pane key="users" :tab="t('admin.iam.tabUsers')">
          <a-card :bordered="false" class="admin-card pane-card">
            <div class="toolbar-area pane-toolbar">
              <TableFilterBar
                :query="query"
                :filters="userFilterSpecs"
                :search-placeholder="t('admin.iam.searchPlaceholder')"
                :search-width="240"
                @update="Object.assign(query, $event)"
                @search="load"
              />
              <a-button type="primary" class="toolbar-end" @click="createOpen = true">
                {{ t('admin.iam.createUser') }}
              </a-button>
            </div>

            <EmptyState v-if="!loading && users.length === 0" :title="t('admin.iam.users')" />
            <OdTable
              v-else
              :columns="userColumns"
              :data-source="users"
              :loading="loading"
              row-key="id"
              :pagination="{ pageSize: 10 }"
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
        </a-tab-pane>

        <!-- ═══ 角色：角色绑定权限 ═══ -->
        <a-tab-pane key="roles" :tab="t('admin.iam.tabRoles')">
          <a-card :bordered="false" class="admin-card pane-card">
            <template #extra>
              <a-button size="small" type="primary" @click="openRoleCreate">{{ t('admin.iam.addRole') }}</a-button>
            </template>
            <div class="toolbar-area">
              <a-input
                v-model:value="roleQuery.keyword"
                :placeholder="t('admin.iam.roleSearchPlaceholder')"
                style="width: 260px"
                allow-clear
                :prefix="undefined"
              />
              <a-button type="primary" class="toolbar-end" @click="openRoleCreate">
                {{ t('admin.iam.addRole') }}
              </a-button>
            </div>
            <OdTable
              :columns="roleColumns"
              :data-source="visibleRoleRows"
              row-key="code"
              :pagination="{ pageSize: 10 }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'role'">
                  <div class="role-name-cell">
                    <strong>{{ record.name || 中文展示(record.code) }}</strong>
                    <span class="cell-mono">{{ record.code }}</span>
                  </div>
                </template>
                <template v-else-if="column.key === 'permissions'">
                  <a-space size="small" wrap>
                    <a-tag v-for="permission in (record.permissions ?? []).slice(0, 3)" :key="permission">
                      {{ permissionLabel(permission) }}
                    </a-tag>
                    <a-tag v-if="(record.permissions ?? []).length > 3">+{{ record.permissions.length - 3 }}</a-tag>
                  </a-space>
                </template>
                <template v-else-if="column.key === 'members'">{{ record.memberCount }} 人</template>
                <template v-else-if="column.key === 'action'">
                  <a-space size="small">
                    <a-button size="small" type="primary" ghost @click="inspectRole(record)">
                      {{ t('admin.iam.viewPermissions') }}
                    </a-button>
                    <a-button size="small" @click="openRolePermEditor(record)">{{ t('admin.iam.bindPermissions') }}</a-button>
                    <a-button size="small" danger :disabled="roleMembersByCode(record.code).length > 0" @click="deleteRole(record)">
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
                  </a-space>
                </template>
              </template>
            </OdTable>
          </a-card>
        </a-tab-pane>

        <!-- ═══ 权限：字典（页面访问/操作）+ 访问策略 + 外部副本 ═══ -->
        <a-tab-pane key="permissions" :tab="t('admin.iam.tabPermissions')">
          <a-card :bordered="false" class="admin-card pane-card">
            <h4 class="perm-group-title">{{ t('admin.iam.permAccessTitle') }}</h4>
            <p class="card-hint">{{ t('admin.iam.permAccessHint') }}</p>
            <div v-for="permission in ACCESS_PERMISSIONS" :key="permission.key" class="perm-row">
              <span class="perm-label">{{ permission.label }}</span>
              <span class="cell-mono perm-key">{{ permission.key }}</span>
              <span class="perm-roles">{{ rolesOfPermission(permission.key).join('、') || t('admin.iam.noBoundRoles') }}</span>
            </div>

            <h4 class="perm-group-title">{{ t('admin.iam.permOperationTitle') }}</h4>
            <p class="card-hint">{{ t('admin.iam.permOperationHint') }}</p>
            <div v-for="permission in OPERATION_PERMISSIONS" :key="permission.key" class="perm-row">
              <span class="perm-label">{{ permission.label }}</span>
              <span class="cell-mono perm-key">{{ permission.key }}</span>
              <span class="perm-roles">{{ rolesOfPermission(permission.key).join('、') || t('admin.iam.noBoundRoles') }}</span>
            </div>
          </a-card>

          <a-card :bordered="false" class="admin-card pane-card" :title="t('admin.iam.policyBlockTitle')">
            <p class="card-hint">{{ t('admin.iam.policyHint') }}</p>
            <EmptyState v-if="policies.length === 0" :title="t('admin.iam.policies')" />
            <OdTable
              v-else
              :columns="policyColumns"
              :data-source="policies"
              row-key="id"
              :pagination="false"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'roles'">
                  <a-space size="small" wrap>
                    <a-tag v-for="role in record.roles" :key="role">{{ 中文展示(role) }}</a-tag>
                  </a-space>
                </template>
              </template>
            </OdTable>
          </a-card>

          <a-card :bordered="false" class="admin-card pane-card" :title="t('admin.iam.externalTitle')">
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
        </a-tab-pane>

        <!-- ═══ 审计日志 ═══ -->
        <a-tab-pane key="audit" :tab="t('admin.iam.tabAudit')">
          <a-card :bordered="false" class="admin-card pane-card">
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
        </a-tab-pane>

        <!-- ═══ 组织：部门树 ═══ -->
        <a-tab-pane key="org" :tab="t('admin.iam.tabOrg')">
          <a-card :bordered="false" class="admin-card pane-card">
            <OrgTreeView />
          </a-card>
        </a-tab-pane>
      </a-tabs>

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

      <!-- 配置用户角色（用户绑定角色） -->
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
                      <strong>{{ role.name || 中文展示(role.code) }}</strong>
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
              <a-tag v-for="permission in effectiveRolePermissions" :key="permission" color="blue">{{ permissionLabel(permission) }}</a-tag>
            </a-space>
          </div>
        </template>
      </a-modal>

      <!-- 角色详情（权限清单） -->
      <a-drawer v-model:open="roleDrawerOpen" :title="inspectedRole ? t('admin.iam.roleDetail') + '：' + (inspectedRole.name || 中文展示(inspectedRole.code)) : ''" width="520">
        <template v-if="inspectedRole">
          <a-space wrap>
            <span class="cell-mono">{{ inspectedRole.code }}</span>
            <a-tag color="blue">{{ inspectedRole.permissions.length }} {{ t('admin.iam.permissionCount') }}</a-tag>
          </a-space>
          <h3 class="drawer-section-title">{{ t('admin.iam.permBoundPermissions') }}</h3>
          <a-space size="small" wrap>
            <a-tag v-for="permission in inspectedRole.permissions" :key="permission" color="blue">{{ permissionLabel(permission) }}</a-tag>
          </a-space>
          <h3 class="drawer-section-title">{{ t('admin.iam.roleMembers') }}</h3>
          <ul class="role-member-list">
            <li v-for="member in roleMembersByCode(inspectedRole.code)" :key="member.id">
              <span>{{ member.name }}（{{ member.username }}）</span>
              <a-tag :color="member.status === 'ACTIVE' ? 'success' : 'default'">{{ member.status === 'ACTIVE' ? t('admin.iam.active') : t('admin.iam.disabled') }}</a-tag>
            </li>
          </ul>
        </template>
      </a-drawer>

      <!-- 角色新增 -->
      <a-modal v-model:open="roleCreateOpen" :title="t('admin.iam.addRole')" :confirm-loading="roleCreating" @ok="submitRoleCreate">
        <a-form layout="vertical">
          <a-form-item :label="t('admin.iam.roleCode')" required>
            <a-input v-model:value="roleCreateForm.code" :placeholder="t('admin.iam.roleCodePlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('common.name')" required>
            <a-input v-model:value="roleCreateForm.name" />
          </a-form-item>
          <a-form-item :label="t('admin.iam.roleDescription')">
            <a-textarea v-model:value="roleCreateForm.description" :rows="2" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 角色权限绑定抽屉（角色 → 权限） -->
      <a-drawer v-model:open="rolePermOpen" :title="`${t('admin.iam.bindPermissions')}：${rolePermName}`" width="520">
        <h4 class="perm-group-title">{{ t('admin.iam.permAccessTitle') }}</h4>
        <a-checkbox-group :value="rolePermDraft" class="perm-check-group" @update:value="(checked: string[]) => (rolePermDraft = checked)">
          <a-checkbox v-for="permission in ACCESS_PERMISSIONS" :key="permission.key" :value="permission.key">
            {{ permission.label }}
          </a-checkbox>
        </a-checkbox-group>
        <h4 class="perm-group-title">{{ t('admin.iam.permOperationTitle') }}</h4>
        <a-checkbox-group :value="rolePermDraft" class="perm-check-group" @update:value="(checked: string[]) => (rolePermDraft = checked)">
          <a-checkbox v-for="permission in OPERATION_PERMISSIONS" :key="permission.key" :value="permission.key">
            {{ permission.label }}
          </a-checkbox>
        </a-checkbox-group>
        <div class="perm-drawer-footer">
          <a-button type="primary" :loading="rolePermSaving" @click="saveRolePermissions">
            {{ t('common.save') }}
          </a-button>
        </div>
      </a-drawer>
    </div>
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

.iam-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

.pane-card {
  border-radius: 10px;
}

.pane-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.pane-toolbar :deep(.table-filter-bar) {
  flex: 1;
}

.pane-toolbar .toolbar-end {
  margin-left: auto;
}

/* ── 权限字典/绑定抽屉（C-反馈重构新增） ── */
.perm-group-title {
  margin: 14px 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.perm-group-title:first-of-type {
  margin-top: 0;
}

.perm-row {
  display: grid;
  grid-template-columns: 160px 200px 1fr;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
  font-size: 13px;
  align-items: center;
}

.perm-label {
  font-weight: 500;
}

.perm-key {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.perm-roles {
  font-size: 12px;
  color: var(--od-color-ink-soft, #334e68);
}

.perm-check-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
  margin-bottom: 8px;
}

.perm-drawer-footer {
  margin-top: 16px;
  text-align: right;
}
</style>
