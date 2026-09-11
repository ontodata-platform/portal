<script setup lang="ts">
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  PlusOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { requirementApi } from '@/api/portal'
import { statusColorMap, statusLabelMap } from '@/constants/statusMeta'
import { useMessageStore } from '@/stores/message'
import type { DataRequirementProfile, RequirementRequest } from '@/types/portal'
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
  dataProfile: {
    businessDomain: '',
    dataObject: '',
    scope: '',
    granularity: '',
    fields: '',
    useCase: '',
    sensitivity: 'INTERNAL' as DataRequirementProfile['sensitivity'],
  },
})

const transitioning = ref(false)

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true, mono: true },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 130, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.requester'), dataIndex: 'requester', key: 'requester', width: 120, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120, odSortable: true },
  { title: t('requirements.assigneeTarget'), dataIndex: 'assigneeSystem', key: 'assigneeSystem', width: 150, odEllipsis: true, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 180 },
])

// C1-3：状态颜色统一来自字典
const statusColor = computed(() => statusColorMap('requirement'))

const typeLabel = computed(
  () =>
    ({
      DATA: t('requirements.dataRequirement'),
      ALGORITHM: t('requirements.algorithmRequirement'),
      COMPREHENSIVE: t('requirements.comprehensiveRequirement'),
    }) as Record<string, string>,
)

const statusText = computed(() => statusLabelMap('requirement', t))

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
  const dataProfile = buildDataProfile()
  if (createForm.requirementType === 'DATA' && !dataProfile) {
    messageStore.warning(t('requirements.dataProfileIncomplete'))
    return
  }
  creating.value = true
  try {
    await requirementApi.create({
      requirementType: createForm.requirementType,
      title: createForm.title,
      description: createForm.description || undefined,
      dataProfile: dataProfile ?? undefined,
    })
    messageStore.success(t('requirements.created'))
    createOpen.value = false
    createForm.title = ''
    createForm.description = ''
    resetDataProfile()
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    creating.value = false
  }
}

function buildDataProfile(): DataRequirementProfile | null {
  if (createForm.requirementType !== 'DATA') return null
  const profile = createForm.dataProfile
  const fields = profile.fields
    .split(/[，,]/)
    .map((field) => field.trim())
    .filter(Boolean)
  if (![profile.businessDomain, profile.dataObject, profile.scope, profile.granularity, profile.useCase].every((value) => value.trim()) || fields.length === 0) {
    return null
  }
  return {
    businessDomain: profile.businessDomain.trim(),
    dataObject: profile.dataObject.trim(),
    scope: profile.scope.trim(),
    granularity: profile.granularity.trim(),
    fields,
    useCase: profile.useCase.trim(),
    sensitivity: profile.sensitivity,
  }
}

function resetDataProfile() {
  createForm.dataProfile.businessDomain = ''
  createForm.dataProfile.dataObject = ''
  createForm.dataProfile.scope = ''
  createForm.dataProfile.granularity = ''
  createForm.dataProfile.fields = ''
  createForm.dataProfile.useCase = ''
  createForm.dataProfile.sensitivity = 'INTERNAL'
}

async function transition(action: () => Promise<unknown>, successText: string) {
  transitioning.value = true
  try {
    await action()
    messageStore.success(successText)
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    transitioning.value = false
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
                v-if="record.status === 'OPEN' || record.status === 'ANALYZING'"
                size="small"
                danger
                type="text"
                :loading="transitioning"
                @click="confirmCancel(record)"
              >
                {{ t('requirements.withdraw') }}
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
            <a-input v-model:value="createForm.title" name="title" :placeholder="t('requirements.titlePlaceholder')" />
          </a-form-item>
          <a-form-item name="description" :label="t('requirements.description')">
            <a-textarea v-model:value="createForm.description" name="description" :placeholder="t('requirements.descriptionPlaceholder')" :rows="3" />
          </a-form-item>
          <template v-if="createForm.requirementType === 'DATA'">
            <a-divider orientation="left" plain>{{ t('requirements.dataProfileTitle') }}</a-divider>
            <a-form-item name="businessDomain" :label="t('requirements.businessDomain')" required>
              <a-input v-model:value="createForm.dataProfile.businessDomain" name="businessDomain" :placeholder="t('requirements.businessDomainPlaceholder')" />
            </a-form-item>
            <a-form-item name="dataObject" :label="t('requirements.dataObject')" required>
              <a-input v-model:value="createForm.dataProfile.dataObject" name="dataObject" :placeholder="t('requirements.dataObjectPlaceholder')" />
            </a-form-item>
            <a-form-item name="scope" :label="t('requirements.dataScope')" required>
              <a-input v-model:value="createForm.dataProfile.scope" name="scope" :placeholder="t('requirements.dataScopePlaceholder')" />
            </a-form-item>
            <a-form-item name="granularity" :label="t('requirements.dataGranularity')" required>
              <a-input v-model:value="createForm.dataProfile.granularity" name="granularity" :placeholder="t('requirements.dataGranularityPlaceholder')" />
            </a-form-item>
            <a-form-item name="fields" :label="t('requirements.dataFields')" required>
              <a-input v-model:value="createForm.dataProfile.fields" name="fields" :placeholder="t('requirements.dataFieldsPlaceholder')" />
            </a-form-item>
            <a-form-item name="useCase" :label="t('requirements.dataUseCase')" required>
              <a-input v-model:value="createForm.dataProfile.useCase" name="useCase" :placeholder="t('requirements.dataUseCasePlaceholder')" />
            </a-form-item>
            <a-form-item name="sensitivity" :label="t('requirements.dataSensitivity')" required>
              <a-select v-model:value="createForm.dataProfile.sensitivity" name="sensitivity">
                <a-select-option value="INTERNAL">{{ t('requirements.sensitivityInternal') }}</a-select-option>
                <a-select-option value="SENSITIVE">{{ t('requirements.sensitivitySensitive') }}</a-select-option>
              </a-select>
            </a-form-item>
          </template>
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

.status-tag {
  font-weight: 500;
  border-radius: 4px;
}
</style>
