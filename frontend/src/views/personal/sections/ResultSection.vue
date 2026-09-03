<script setup lang="ts">
import { CopyOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { resultApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalResult } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t, locale } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
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
  { title: t('results.resultId'), dataIndex: 'resultId', key: 'resultId', width: 220 },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem', width: 160 },
  { title: t('common.type'), dataIndex: 'resultType', key: 'resultType', width: 140 },
  { title: t('results.relatedTask'), dataIndex: 'sourceTaskId', key: 'sourceTaskId', width: 200 },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 100 },
])

function formatTime(value: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleString(locale.value)
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text)
  messageStore.success(`${label}已复制到剪贴板`)
}

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
    loadError.value = describeLoadError(error)
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
  <div class="result-section">
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('menu.results')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="results-card">
      <div class="toolbar-area">
        <a-space wrap>
          <a-input
            v-model:value="query.domain"
            :placeholder="t('results.domainPlaceholder')"
            style="width: 160px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-input
            v-model:value="query.type"
            :placeholder="t('results.typePlaceholder')"
            style="width: 160px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-input
            v-model:value="query.keyword"
            :placeholder="t('results.keywordPlaceholder')"
            style="width: 180px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button type="primary" @click="query.page = 1; load()">
            <template #icon><SearchOutlined /></template>
            {{ t('common.query') }}
          </a-button>
        </a-space>

        <a-button type="primary" @click="registerOpen = true">
          <template #icon><PlusOutlined /></template>
          {{ t('results.registerButton') }}
        </a-button>
      </div>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('results.emptyTitle')"
        :description="t('results.emptyDesc')"
        :action-label="t('menu.tasks')"
        @action="router.push('/personal/tasks')"
      />

      <a-table
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="resultId"
        class="result-table"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1;
            load();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'resultId'">
            <div class="id-cell">
              <span class="mono-text">{{ record.resultId }}</span>
              <button
                type="button"
                class="icon-btn"
                title="复制标识"
                @click.stop="copyText(record.resultId, '结果标识')"
              >
                <CopyOutlined />
              </button>
            </div>
          </template>

          <template v-else-if="column.key === 'resultType'">
            <a-tag :color="record.resultType === 'DATASET' ? 'blue' : record.resultType === 'REPORT' ? 'green' : 'purple'">
              {{ record.resultType }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'sourceTaskId'">
            <span v-if="record.sourceTaskId" class="mono-text">{{ record.sourceTaskId }}</span>
            <span v-else class="text-muted">-</span>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span class="time-text">{{ formatTime(record.updatedAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="link" @click="openDetail(record)">
              <template #icon><EyeOutlined /></template>
              {{ t('common.detail') }}
            </a-button>
          </template>
        </template>
      </a-table>

      <!-- 登记结果集弹窗 -->
      <a-modal
        v-model:open="registerOpen"
        :title="t('results.registerModal')"
        :confirm-loading="registering"
        width="560px"
        @ok="register"
      >
        <a-form layout="vertical">
          <a-form-item :label="t('common.sourceSystem')" required>
            <a-select v-model:value="registerForm.sourceSystem">
              <a-select-option value="data-platform">data-platform (数据管理平台)</a-select-option>
              <a-select-option value="algorithm-transform">algorithm-transform (算法转换工具)</a-select-option>
              <a-select-option value="algorithm-recombine">algorithm-recombine (算法重组平台)</a-select-option>
              <a-select-option value="ontology-platform">ontology-platform (本体平台)</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('results.resultId')" required>
            <a-input v-model:value="registerForm.resultId" :placeholder="t('results.resultIdPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('common.type')" required>
            <a-select v-model:value="registerForm.resultType">
              <a-select-option value="DATASET">DATASET (结构化数据集)</a-select-option>
              <a-select-option value="REPORT">REPORT (分析报告)</a-select-option>
              <a-select-option value="EXECUTION_OUTPUT">EXECUTION_OUTPUT (执行产出物)</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="t('results.sourceTaskIdLabel')">
            <a-input v-model:value="registerForm.sourceTaskId" :placeholder="t('results.sourceTaskIdPlaceholder')" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 结果详情弹窗 -->
      <a-modal v-model:open="detailOpen" :title="t('results.detailModal')" :footer="null" width="680px">
        <a-descriptions v-if="detail" :column="2" bordered size="middle">
          <a-descriptions-item :label="t('results.resultId')" :span="2">
            <span class="mono-text">{{ detail.resultId }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('common.sourceSystem')">{{ detail.sourceSystem }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.type')">{{ detail.resultType }}</a-descriptions-item>
          <a-descriptions-item :label="t('results.relatedTask')" :span="2">
            <span class="mono-text">{{ detail.sourceTaskId ?? '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.resourceRefs')" :span="2">
            <span v-if="detail.resourceRefs.length > 0">{{ detail.resourceRefs.join('、') }}</span>
            <span v-else class="text-muted">-</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.traceId')" :span="2">
            <span class="mono-text">{{ detail.traceId ?? '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('results.metadata')" :span="2">
            <pre class="meta-code">{{ JSON.stringify(detail.metadata, null, 2) || '-' }}</pre>
          </a-descriptions-item>
        </a-descriptions>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.results-card {
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

.id-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mono-text {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.icon-btn {
  border: 0;
  background: transparent;
  padding: 2px 4px;
  color: var(--od-gray-400, #94a3b8);
  cursor: pointer;
  border-radius: 4px;
}

.icon-btn:hover {
  color: var(--od-color-accent, #2563eb);
  background: var(--od-gray-100, #f1f5f9);
}

.time-text {
  font-size: 13px;
  color: var(--od-gray-500, #64748b);
}

.text-muted {
  color: var(--od-gray-400, #94a3b8);
}

.meta-code {
  background: var(--od-gray-50, #f8fafc);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
  max-height: 160px;
  overflow: auto;
  margin: 0;
}
</style>
