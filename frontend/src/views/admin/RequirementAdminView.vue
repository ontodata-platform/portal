<script setup lang="ts">
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { requirementApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { RequirementRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const ASSIGN_TARGETS = [
  { value: 'data-platform', labelKey: 'admin.requirements.targetData' },
  { value: 'ontology-platform', labelKey: 'admin.requirements.targetOntology' },
  { value: 'algorithm-transform', labelKey: 'admin.requirements.targetTransform' },
  { value: 'algorithm-recombine', labelKey: 'admin.requirements.targetRecombine' },
  { value: 'portal', labelKey: 'admin.requirements.targetPortal' },
] as const

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<RequirementRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '', keyword: '' })

const drawerOpen = ref(false)
const current = ref<RequirementRequest | null>(null)
const acting = ref(false)
const assignForm = reactive({ assigneeSystem: 'data-platform', assigneeRef: '' })
const closeForm = reactive({ closedNote: '' })

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 130, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', width: 220, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 110, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('common.requester'), dataIndex: 'requester', key: 'requester', width: 100, odEllipsis: true, odSortable: true },
  { title: t('admin.requirements.updatedAt'), dataIndex: 'updatedAtText', key: 'updatedAtText', width: 130, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 90 },
])

const statusColor: Record<string, string> = {
  OPEN: 'cyan',
  ANALYZING: 'processing',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
}

const typeLabel = computed(
  () =>
    ({
      DATA: t('requirements.dataRequirement'),
      ALGORITHM: t('requirements.algorithmRequirement'),
      COMPREHENSIVE: t('requirements.comprehensiveRequirement'),
    }) as Record<string, string>,
)

const statusText = computed(
  () =>
    ({
      OPEN: t('requirements.open'),
      ANALYZING: t('requirements.analyzing'),
      ASSIGNED: t('requirements.assigned'),
      IN_PROGRESS: t('requirements.inProgress'),
      COMPLETED: t('requirements.completed'),
      CANCELED: t('requirements.canceled'),
    }) as Record<string, string>,
)

const timelineSteps = computed(() => {
  const status = current.value?.status ?? 'OPEN'
  const rank: Record<string, number> = {
    OPEN: 0,
    ANALYZING: 1,
    ASSIGNED: 2,
    IN_PROGRESS: 4,
    COMPLETED: 5,
    CANCELED: 5,
  }
  const currentRank = rank[status] ?? 0
  return [
    { key: 'received', label: t('admin.requirements.received'), min: 0 },
    { key: 'analyzed', label: t('admin.requirements.analyzed'), min: 1 },
    { key: 'assigned', label: t('admin.requirements.assigned'), min: 2 },
    { key: 'planned', label: t('admin.requirements.planned'), min: 3 },
    { key: 'executing', label: t('admin.requirements.executing'), min: 4 },
    { key: 'closed', label: t('admin.requirements.closed'), min: 5 },
  ].map((step) => ({
    ...step,
    color: currentRank > step.min ? 'green' : currentRank === step.min ? 'blue' : 'gray',
  }))
})

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
    const page = await requirementApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      type: query.type || undefined,
      keyword: query.keyword || undefined,
    })
    rows.value = page.items.map((item) => ({ ...item, updatedAtText: formatDateTime(item.updatedAt) }))
    total.value = page.total
    if (current.value) {
      current.value = page.items.find((item) => item.code === current.value?.code) ?? current.value
    }
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openHandle(record: RequirementRequest) {
  current.value = record
  assignForm.assigneeSystem = record.assigneeSystem || 'data-platform'
  assignForm.assigneeRef = record.assigneeRef || ''
  closeForm.closedNote = ''
  drawerOpen.value = true
}

async function runAction(action: () => Promise<unknown>, successText: string) {
  acting.value = true
  try {
    const updated = (await action()) as RequirementRequest
    messageStore.success(successText)
    if (updated?.code) current.value = updated
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    acting.value = false
  }
}

async function analyze() {
  if (!current.value) return
  await runAction(() => requirementApi.analyze(current.value!.code), t('requirements.analyzed', { code: current.value.code }))
}

async function assign() {
  if (!current.value) return
  await runAction(
    () =>
      requirementApi.assign(current.value!.code, {
        assigneeSystem: assignForm.assigneeSystem,
        assigneeRef: assignForm.assigneeRef || undefined,
      }),
    t('requirements.assignedTo', { code: current.value.code, system: assignForm.assigneeSystem }),
  )
}

async function progress() {
  if (!current.value) return
  await runAction(() => requirementApi.progress(current.value!.code), t('requirements.progressed', { code: current.value.code }))
}

async function complete() {
  if (!current.value || !closeForm.closedNote.trim()) return
  await runAction(
    () => requirementApi.complete(current.value!.code, { closedNote: closeForm.closedNote }),
    t('requirements.completedMessage', { code: current.value.code }),
  )
}

async function cancel() {
  if (!current.value) return
  await runAction(
    () => requirementApi.cancel(current.value!.code, { closedNote: closeForm.closedNote || undefined }),
    t('requirements.canceledMessage', { code: current.value.code }),
  )
}

onMounted(load)
</script>

<template>
  <div class="requirement-admin-view">
    <PageHeader :eyebrow="t('menu.admin')" :title="t('menu.adminRequirements')" />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="admin-card">
      <div class="toolbar-area">
        <a-space wrap>
          <a-select v-model:value="query.status" :placeholder="t('requirements.statusPlaceholder')" allow-clear style="width: 140px">
            <a-select-option value="OPEN">{{ t('requirements.open') }}</a-select-option>
            <a-select-option value="ANALYZING">{{ t('requirements.analyzing') }}</a-select-option>
            <a-select-option value="ASSIGNED">{{ t('requirements.assigned') }}</a-select-option>
            <a-select-option value="IN_PROGRESS">{{ t('requirements.inProgress') }}</a-select-option>
            <a-select-option value="COMPLETED">{{ t('requirements.completed') }}</a-select-option>
            <a-select-option value="CANCELED">{{ t('requirements.canceled') }}</a-select-option>
          </a-select>
          <a-select v-model:value="query.type" :placeholder="t('requirements.typePlaceholder')" allow-clear style="width: 140px">
            <a-select-option value="DATA">{{ t('requirements.dataRequirement') }}</a-select-option>
            <a-select-option value="ALGORITHM">{{ t('requirements.algorithmRequirement') }}</a-select-option>
            <a-select-option value="COMPREHENSIVE">{{ t('requirements.comprehensiveRequirement') }}</a-select-option>
          </a-select>
          <a-input
            v-model:value="query.keyword"
            :placeholder="t('admin.requirements.keywordPlaceholder')"
            style="width: 200px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button type="primary" @click="query.page = 1; load()">
            <template #icon><SearchOutlined /></template>
            {{ t('common.query') }}
          </a-button>
        </a-space>
      </div>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('admin.requirements.emptyTitle')"
        :description="t('admin.requirements.emptyDesc')"
      />

      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="code"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1
            load()
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono-code">{{ record.code }}</span>
          </template>
          <template v-else-if="column.key === 'requirementType'">
            <a-tag :color="record.requirementType === 'DATA' ? 'cyan' : record.requirementType === 'ALGORITHM' ? 'purple' : 'blue'">
              {{ typeLabel[record.requirementType] ?? record.requirementType }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]" class="status-tag">
              <template #icon>
                <FieldTimeOutlined v-if="record.status === 'OPEN'" />
                <SyncOutlined v-else-if="record.status === 'IN_PROGRESS' || record.status === 'ANALYZING'" spin />
                <CheckCircleOutlined v-else-if="record.status === 'COMPLETED'" />
                <CloseCircleOutlined v-else-if="record.status === 'CANCELED'" />
              </template>
              {{ statusText[record.status] ?? record.status }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="primary" ghost @click="openHandle(record)">
              {{ t('admin.requirements.handle') }}
            </a-button>
          </template>
        </template>
      </OdTable>
    </a-card>

    <a-drawer v-model:open="drawerOpen" :title="current ? `${t('admin.requirements.handle')} ${current.code}` : ''" width="480">
      <template v-if="current">
        <a-descriptions :column="1" size="small" class="drawer-meta">
          <a-descriptions-item :label="t('common.title')">{{ current.title }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.requester')">{{ current.requester }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ statusText[current.status] ?? current.status }}</a-descriptions-item>
          <a-descriptions-item :label="t('requirements.assigneeTarget')">{{ current.assigneeSystem || '—' }}</a-descriptions-item>
        </a-descriptions>

        <h3 class="drawer-section">{{ t('admin.requirements.timeline') }}</h3>
        <a-timeline>
          <a-timeline-item v-for="step in timelineSteps" :key="step.key" :color="step.color">
            {{ step.label }}
          </a-timeline-item>
        </a-timeline>

        <a-form v-if="current.status === 'ANALYZING'" layout="vertical">
          <a-form-item name="assigneeSystem" :label="t('requirements.assignTargetLabel')" required>
            <a-select v-model:value="assignForm.assigneeSystem">
              <a-select-option v-for="target in ASSIGN_TARGETS" :key="target.value" :value="target.value">
                {{ t(target.labelKey) }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="assigneeRef" :label="t('admin.requirements.assignNote')">
            <a-input v-model:value="assignForm.assigneeRef" :placeholder="t('admin.requirements.assignNotePlaceholder')" />
          </a-form-item>
        </a-form>

        <a-form v-if="current.status === 'IN_PROGRESS' || current.status === 'OPEN' || current.status === 'ANALYZING'" layout="vertical">
          <a-form-item v-if="current.status === 'IN_PROGRESS'" name="closedNote" :label="t('requirements.closedNoteLabel')" required>
            <a-textarea v-model:value="closeForm.closedNote" :placeholder="t('requirements.closedNotePlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </template>

      <template #footer>
        <a-space wrap>
          <a-button v-if="current?.status === 'OPEN'" type="primary" :loading="acting" @click="analyze">
            {{ t('requirements.analyze') }}
          </a-button>
          <a-button v-if="current?.status === 'ANALYZING'" type="primary" :loading="acting" @click="assign">
            {{ t('requirements.assign') }}
          </a-button>
          <a-button v-if="current?.status === 'ASSIGNED' || current?.status === 'IN_PROGRESS'" type="primary" :loading="acting" @click="progress">
            {{ t('admin.requirements.progress') }}
          </a-button>
          <a-button
            v-if="current?.status === 'IN_PROGRESS'"
            type="primary"
            :loading="acting"
            :disabled="!closeForm.closedNote.trim()"
            @click="complete"
          >
            {{ t('requirements.complete') }}
          </a-button>
          <a-button
            v-if="current && current.status !== 'COMPLETED' && current.status !== 'CANCELED'"
            danger
            :loading="acting"
            @click="cancel"
          >
            {{ t('requirements.cancel') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.admin-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.status-tag {
  font-weight: 500;
  border-radius: 4px;
}

.drawer-meta {
  margin-bottom: 16px;
}

.drawer-section {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 650;
}
</style>
