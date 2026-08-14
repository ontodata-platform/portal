<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { resultApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalResult } from '@/types/portal'

const { t, locale } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalResult[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, type: '', domain: '', keyword: '' })

const registerOpen = ref(false)
const registering = ref(false)
const registerForm = reactive({
  sourceSystem: 'data-platform',
  resultId: '',
  resultType: 'DATASET',
  sourceTaskId: '',
})

const detailOpen = ref(false)
const detail = ref<PortalResult | null>(null)

const columns = computed(() => [
  { title: t('results.resultId'), dataIndex: 'resultId', key: 'resultId' },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem' },
  { title: t('common.type'), dataIndex: 'resultType', key: 'resultType' },
  { title: t('results.relatedTask'), dataIndex: 'sourceTaskId', key: 'sourceTaskId' },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
])

/** 日期时间按当前界面语言格式化（M5 国际化）。 */
function formatTime(value: string): string {
  return new Date(value).toLocaleString(locale.value)
}

async function load() {
  loading.value = true
  try {
    const page = await resultApi.list({
      page: query.page,
      size: query.size,
      type: query.type || undefined,
      domain: query.domain || undefined,
      keyword: query.keyword || undefined,
    })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function register() {
  registering.value = true
  try {
    await resultApi.register(registerForm.sourceSystem, registerForm.resultId, {
      resultType: registerForm.resultType,
      sourceTaskId: registerForm.sourceTaskId || undefined,
    })
    messageStore.success(t('results.registered'))
    registerOpen.value = false
    registerForm.resultId = ''
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    registering.value = false
  }
}

async function openDetail(record: PortalResult) {
  try {
    detail.value = await resultApi.find(record.sourceSystem, record.resultId)
    detailOpen.value = true
  } catch (error) {
    messageStore.reportError(error)
  }
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-input v-model:value="query.domain" :placeholder="t('results.domainPlaceholder')" style="width: 200px" />
      <a-input v-model:value="query.type" :placeholder="t('results.typePlaceholder')" style="width: 220px" />
      <a-input v-model:value="query.keyword" :placeholder="t('results.keywordPlaceholder')" style="width: 180px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        {{ t('common.query') }}
      </a-button>
      <a-button @click="registerOpen = true">{{ t('results.registerButton') }}</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="resultId"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'updatedAt'">
          {{ formatTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="registerOpen" :title="t('results.registerModal')" :confirm-loading="registering" @ok="register">
      <a-form layout="vertical">
        <a-form-item :label="t('common.sourceSystem')" required>
          <a-select v-model:value="registerForm.sourceSystem">
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
            <a-select-option value="ontology-platform">ontology-platform</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('results.resultId')" required>
          <a-input v-model:value="registerForm.resultId" :placeholder="t('results.resultIdPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('common.type')" required>
          <a-select v-model:value="registerForm.resultType">
            <a-select-option value="DATASET">DATASET</a-select-option>
            <a-select-option value="REPORT">REPORT</a-select-option>
            <a-select-option value="EXECUTION_OUTPUT">EXECUTION_OUTPUT</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('results.sourceTaskIdLabel')">
          <a-input v-model:value="registerForm.sourceTaskId" :placeholder="t('results.sourceTaskIdPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="detailOpen" :title="t('results.detailModal')" :footer="null" width="640px">
      <a-descriptions v-if="detail" :column="1" bordered size="small">
        <a-descriptions-item :label="t('results.resultId')">{{ detail.resultId }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.sourceSystem')">{{ detail.sourceSystem }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.type')">{{ detail.resultType }}</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.resourceRefs')">{{ detail.resourceRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('results.metadata')">{{ JSON.stringify(detail.metadata) || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('results.relatedTask')">{{ detail.sourceTaskId ?? '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.traceId')">{{ detail.traceId ?? '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </a-card>
</template>
