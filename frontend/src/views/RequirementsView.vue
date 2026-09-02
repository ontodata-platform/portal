<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { requirementApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { RequirementRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

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

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 130 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.requester'), dataIndex: 'requester', key: 'requester', width: 120 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110 },
  { title: t('requirements.assigneeTarget'), dataIndex: 'assigneeSystem', key: 'assigneeSystem', width: 150 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 180 },
])

const statusColor: Record<string, string> = {
  OPEN: 'default',
  ANALYZING: 'processing',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
}

/** 需求类型展示文案（协议编码不变，界面按语言翻译）。 */
const typeLabel = computed(
  () =>
    ({
      DATA: t('requirements.dataRequirement'),
      ALGORITHM: t('requirements.algorithmRequirement'),
      COMPREHENSIVE: t('requirements.comprehensiveRequirement'),
    }) as Record<string, string>,
)

/** 需求状态展示文案（协议编码不变，界面按语言翻译）。 */
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
  try {
    await action()
    messageStore.success(successText)
    closeOpen.value = false
    assignOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
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

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupCollab')"
      :title="t('menu.requirements')"
      :description="t('requirements.pageDesc')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="requirements-card">
    <a-space style="margin-bottom: 16px" wrap>
      <a-select v-model:value="query.status" :placeholder="t('requirements.statusPlaceholder')" allow-clear style="width: 150px">
        <a-select-option value="OPEN">{{ t('requirements.open') }}</a-select-option>
        <a-select-option value="ANALYZING">{{ t('requirements.analyzing') }}</a-select-option>
        <a-select-option value="ASSIGNED">{{ t('requirements.assigned') }}</a-select-option>
        <a-select-option value="IN_PROGRESS">{{ t('requirements.inProgress') }}</a-select-option>
        <a-select-option value="COMPLETED">{{ t('requirements.completed') }}</a-select-option>
        <a-select-option value="CANCELED">{{ t('requirements.canceled') }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.type" :placeholder="t('requirements.typePlaceholder')" allow-clear style="width: 150px">
        <a-select-option value="DATA">{{ t('requirements.dataRequirement') }}</a-select-option>
        <a-select-option value="ALGORITHM">{{ t('requirements.algorithmRequirement') }}</a-select-option>
        <a-select-option value="COMPREHENSIVE">{{ t('requirements.comprehensiveRequirement') }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" :placeholder="t('requirements.keywordPlaceholder')" style="width: 180px" allow-clear />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
      >
        {{ t('common.query') }}
      </a-button>
      <a-button @click="createOpen = true">{{ t('requirements.createButton') }}</a-button>
    </a-space>

    <EmptyState
      v-if="!loading && rows.length === 0"
      :title="t('requirements.emptyTitle')"
      :description="t('requirements.emptyDesc')"
      :action-label="t('requirements.createButton')"
      @action="createOpen = true"
    />
    <a-table
      v-else
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'requirementType'">
          {{ typeLabel[record.requirementType] ?? record.requirementType }}
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status]">{{ statusText[record.status] ?? record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="record.status === 'OPEN'"
              size="small"
              type="primary"
              @click="analyze(record)"
            >
              {{ t('requirements.analyze') }}
            </a-button>
            <a-button
              v-if="record.status === 'ANALYZING'"
              size="small"
              type="primary"
              @click="openAssign(record)"
            >
              {{ t('requirements.assign') }}
            </a-button>
            <a-button
              v-if="record.status === 'ASSIGNED'"
              size="small"
              type="primary"
              @click="transition(() => requirementApi.progress(record.code), t('requirements.progressed', { code: record.code }))"
            >
              {{ t('requirements.start') }}
            </a-button>
            <a-button
              v-if="record.status === 'IN_PROGRESS'"
              size="small"
              type="primary"
              @click="openComplete(record)"
            >
              {{ t('requirements.complete') }}
            </a-button>
            <a-button
              v-if="record.status === 'OPEN' || record.status === 'ANALYZING'"
              size="small"
              danger
              @click="cancel(record)"
            >
              {{ t('requirements.cancel') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="createOpen" :title="t('requirements.createModal')" :confirm-loading="creating" @ok="create">
      <a-form layout="vertical">
        <a-form-item :label="t('requirements.requirementType')" required>
          <a-radio-group v-model:value="createForm.requirementType">
            <a-radio value="DATA">{{ t('requirements.dataRequirement') }}</a-radio>
            <a-radio value="ALGORITHM">{{ t('requirements.algorithmRequirement') }}</a-radio>
            <a-radio value="COMPREHENSIVE">{{ t('requirements.comprehensiveRequirement') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('common.title')" required>
          <a-input v-model:value="createForm.title" :placeholder="t('requirements.titlePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('requirements.description')">
          <a-textarea v-model:value="createForm.description" :placeholder="t('requirements.descriptionPlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="assignOpen" :title="t('requirements.assignModal')" :confirm-loading="assigning" @ok="assign">
      <a-form layout="vertical">
        <a-form-item :label="t('requirements.assignTargetLabel')" required>
          <a-select v-model:value="assignForm.assigneeSystem">
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
            <a-select-option value="ontology-platform">ontology-platform</a-select-option>
            <a-select-option value="mcp-gateway">mcp-gateway</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('requirements.assigneeRefLabel')">
          <a-input v-model:value="assignForm.assigneeRef" :placeholder="t('requirements.assigneeRefPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="closeOpen" :title="t('requirements.completeModal')" :confirm-loading="closing" @ok="complete">
      <a-form layout="vertical">
        <a-form-item :label="t('requirements.closedNoteLabel')" required>
          <a-textarea v-model:value="closeForm.closedNote" :placeholder="t('requirements.closedNotePlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.requirements-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
</style>
