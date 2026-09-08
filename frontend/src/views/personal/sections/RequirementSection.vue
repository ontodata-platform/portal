<script setup lang="ts">
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { requirementApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { RequirementRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import OdTable from '@/ui-kit/OdTable.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<RequirementRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '', keyword: '' })

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({
  requirementType: 'DATA' as 'DATA' | 'ALGORITHM' | 'COMPREHENSIVE',
  title: '',
  description: '',
})

const assignOpen = ref(false)
const assigning = ref(false)
const assignTarget = ref<RequirementRequest | null>(null)
const assignForm = reactive({ assigneeSystem: 'data-platform', assigneeRef: '' })

const closeOpen = ref(false)
const closing = ref(false)
const closeTarget = ref<RequirementRequest | null>(null)
const closeForm = reactive({ closedNote: '' })
const transitioning = ref(false)

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 130, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.requester'), dataIndex: 'requester', key: 'requester', width: 120, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120, odSortable: true },
  { title: t('requirements.assigneeTarget'), dataIndex: 'assigneeSystem', key: 'assigneeSystem', width: 150, odEllipsis: true, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 180 },
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
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function create() {
  creating.value = true
  try {
    await requirementApi.create({
      requirementType: createForm.requirementType,
      title: createForm.title,
      description: createForm.description || undefined,
    })
    messageStore.success(t('requirements.created'))
    createOpen.value = false
    createForm.title = ''
    createForm.description = ''
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    creating.value = false
  }
}

async function transition(action: () => Promise<unknown>, successText: string) {
  transitioning.value = true
  try {
    await action()
    messageStore.success(successText)
    closeOpen.value = false
    assignOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    transitioning.value = false
  }
}

async function analyze(record: RequirementRequest) {
  await transition(
    () => requirementApi.analyze(record.code),
    t('requirements.analyzed', { code: record.code }),
  )
}

async function assign() {
  if (!assignTarget.value) {
    return
  }
  assigning.value = true
  try {
    await requirementApi.assign(assignTarget.value.code, {
      assigneeSystem: assignForm.assigneeSystem,
      assigneeRef: assignForm.assigneeRef || undefined,
    })
    messageStore.success(
      t('requirements.assignedTo', {
        code: assignTarget.value.code,
        system: assignForm.assigneeSystem,
      }),
    )
    assignOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    assigning.value = false
  }
}

function openAssign(record: RequirementRequest) {
  assignTarget.value = record
  assignForm.assigneeSystem = 'data-platform'
  assignForm.assigneeRef = ''
  assignOpen.value = true
}

function openComplete(record: RequirementRequest) {
  closeTarget.value = record
  closeForm.closedNote = ''
  closeOpen.value = true
}

async function complete() {
  if (!closeTarget.value) {
    return
  }
  closing.value = true
  try {
    await requirementApi.complete(closeTarget.value.code, { closedNote: closeForm.closedNote })
    messageStore.success(t('requirements.completedMessage', { code: closeTarget.value.code }))
    closeOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    closing.value = false
  }
}

async function cancel(record: RequirementRequest) {
  await transition(
    () => requirementApi.cancel(record.code, {}),
    t('requirements.canceledMessage', { code: record.code }),
  )
}

function confirmCancel(record: RequirementRequest) {
  Modal.confirm({
    title: '确认撤回此需求？',
    content: '撤回后将终止当前协同处理流程，且不能恢复为进行中状态。',
    okText: '确认撤回',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => cancel(record),
  })
}

onMounted(load)
</script>

<template>
  <div class="requirement-section">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="requirements-card">
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
            :placeholder="t('requirements.keywordPlaceholder')"
            style="width: 180px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button type="primary" @click="query.page = 1; load()">
            <template #icon><SearchOutlined /></template>
            {{ t('common.query') }}
          </a-button>
        </a-space>

        <a-button type="primary" @click="createOpen = true">
          <template #icon><PlusOutlined /></template>
          {{ t('requirements.createButton') }}
        </a-button>
      </div>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('requirements.emptyTitle')"
        :description="t('requirements.emptyDesc')"
        :action-label="t('requirements.createButton')"
        @action="createOpen = true"
      />

      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="code"
        class="requirement-table"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1;
            load();
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

          <template v-else-if="column.key === 'assigneeSystem'">
            {{ 中文展示(record.assigneeSystem) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space size="small">
              <a-button
                v-if="record.status === 'OPEN'"
                size="small"
                type="primary"
                ghost
                :loading="transitioning"
                @click="analyze(record)"
              >
                {{ t('requirements.analyze') }}
              </a-button>
              <a-button
                v-if="record.status === 'ANALYZING'"
                size="small"
                type="primary"
                :loading="transitioning"
                @click="openAssign(record)"
              >
                {{ t('requirements.assign') }}
              </a-button>
              <a-button
                v-if="record.status === 'ASSIGNED'"
                size="small"
                type="primary"
                :loading="transitioning"
                @click="transition(() => requirementApi.progress(record.code), t('requirements.progressed', { code: record.code }))"
              >
                <template #icon><PlayCircleOutlined /></template>
                {{ t('requirements.start') }}
              </a-button>
              <a-button
                v-if="record.status === 'IN_PROGRESS'"
                size="small"
                type="primary"
                :loading="transitioning"
                @click="openComplete(record)"
              >
                {{ t('requirements.complete') }}
              </a-button>
              <a-button
                v-if="record.status === 'OPEN' || record.status === 'ANALYZING'"
                size="small"
                danger
                type="text"
                :loading="transitioning"
                @click="confirmCancel(record)"
              >
                {{ t('requirements.cancel') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </OdTable>

      <!-- 创建需求弹窗 -->
      <a-modal
        v-model:open="createOpen"
        :title="t('requirements.createModal')"
        :confirm-loading="creating"
        width="600px"
        @ok="create"
      >
        <a-form layout="vertical">
          <a-form-item name="requirementType" :label="t('requirements.requirementType')" required>
            <a-radio-group v-model:value="createForm.requirementType" button-style="solid">
              <a-radio-button value="DATA">{{ t('requirements.dataRequirement') }}</a-radio-button>
              <a-radio-button value="ALGORITHM">{{ t('requirements.algorithmRequirement') }}</a-radio-button>
              <a-radio-button value="COMPREHENSIVE">{{ t('requirements.comprehensiveRequirement') }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item name="title" :label="t('common.title')" required>
            <a-input v-model:value="createForm.title" :placeholder="t('requirements.titlePlaceholder')" />
          </a-form-item>
          <a-form-item name="description" :label="t('requirements.description')">
            <a-textarea v-model:value="createForm.description" :placeholder="t('requirements.descriptionPlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 分派协同系统弹窗 -->
      <a-modal v-model:open="assignOpen" :title="t('requirements.assignModal')" :confirm-loading="assigning" @ok="assign">
        <a-form layout="vertical">
          <a-form-item name="assigneeSystem" :label="t('requirements.assignTargetLabel')" required>
            <a-select v-model:value="assignForm.assigneeSystem">
              <a-select-option value="data-platform">数据管理平台</a-select-option>
              <a-select-option value="algorithm-transform">算法转换工具</a-select-option>
              <a-select-option value="algorithm-recombine">算法重组平台</a-select-option>
              <a-select-option value="ontology-platform">本体平台</a-select-option>
              <a-select-option value="mcp-gateway">智能体网关</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="assigneeRef" :label="t('requirements.assigneeRefLabel')">
            <a-input v-model:value="assignForm.assigneeRef" :placeholder="t('requirements.assigneeRefPlaceholder')" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 办结需求弹窗 -->
      <a-modal v-model:open="closeOpen" :title="t('requirements.completeModal')" :confirm-loading="closing" @ok="complete">
        <a-form layout="vertical">
          <a-form-item name="closedNote" :label="t('requirements.closedNoteLabel')" required>
            <a-textarea v-model:value="closeForm.closedNote" :placeholder="t('requirements.closedNotePlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.requirements-card {
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
</style>
