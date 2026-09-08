<script setup lang="ts">
import {
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { algorithmWorkbenchApi } from '@/api/algorithm-workbench'
import { useMessageStore } from '@/stores/message'
import type { AlgorithmRun, AlgorithmServiceSummary } from '@/types/descriptor'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const activeTab = ref<'discover' | 'runs' | 'artifacts'>(routeTab())

function routeTab(): 'discover' | 'runs' | 'artifacts' {
  const tab = router.currentRoute.value.query.tab
  return tab === 'runs' || tab === 'artifacts' ? tab : 'discover'
}

watch(
  () => router.currentRoute.value.query.tab,
  (tab) => {
    if (tab === 'runs' || tab === 'artifacts') activeTab.value = tab
  },
)

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

// ── 发现 ────────────────────────────────────────────────
const servicesLoading = ref(false)
const servicesError = ref('')
const services = ref<AlgorithmServiceSummary[]>([])
const categories = ref<string[]>([])
const selectedCategory = ref('')
const serviceQuery = reactive({ page: 1, size: 20, keyword: '' })

async function loadCategories() {
  try {
    categories.value = await algorithmWorkbenchApi.listCategories()
  } catch {
    categories.value = []
  }
}

async function loadServices() {
  servicesLoading.value = true
  servicesError.value = ''
  try {
    const res = await algorithmWorkbenchApi.listServices({
      ...serviceQuery,
      keyword: serviceQuery.keyword || undefined,
      category: selectedCategory.value || undefined,
    })
    services.value = res.items
  } catch (error) {
    servicesError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    servicesLoading.value = false
  }
}

function pickCategory(category: string) {
  selectedCategory.value = category
  serviceQuery.page = 1
  void loadServices()
}

function openDetail(code: string) {
  void router.push(`/algorithm-workbench/${encodeURIComponent(code)}`)
}

function openWizard(code: string) {
  void router.push(`/algorithm-workbench/${encodeURIComponent(code)}/run`)
}

// ── 我的运行 ────────────────────────────────────────────
const runsLoading = ref(false)
const runsError = ref('')
const runs = ref<AlgorithmRun[]>([])
const expandedTaskIds = ref<string[]>([])
const actionTaskId = ref('')

async function loadRuns() {
  runsLoading.value = true
  runsError.value = ''
  try {
    const res = await algorithmWorkbenchApi.listMyRuns({ page: 1, size: 50 })
    runs.value = res.items.map((run) => ({ ...run, startedAtText: formatDateTime(run.startedAt) }))
  } catch (error) {
    runsError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    runsLoading.value = false
  }
}

const statusColor: Record<string, string> = {
  SUCCEEDED: 'success',
  RUNNING: 'processing',
  FAILED: 'error',
  CANCELLED: 'default',
  BLOCKED: 'warning',
}

function statusText(status: string): string {
  return t(`algoWorkbench.status${status}`)
}

async function rerun(taskId: string) {
  actionTaskId.value = taskId
  try {
    await algorithmWorkbenchApi.rerun(taskId)
    messageStore.success(t('algoWorkbench.rerun'))
    await loadRuns()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    actionTaskId.value = ''
  }
}

async function confirmCancel(taskId: string) {
  Modal.confirm({
    title: '确认取消本次运行？',
    content: '取消后正在执行的节点会停止，已经产生的临时数据不会继续处理。',
    okText: '确认取消',
    cancelText: '返回运行列表',
    okButtonProps: { danger: true },
    onOk: () => cancel(taskId),
  })
}

async function cancel(taskId: string) {
  actionTaskId.value = taskId
  try {
    await algorithmWorkbenchApi.cancel(taskId)
    messageStore.info(t('algoWorkbench.statusCANCELLED'))
    await loadRuns()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    actionTaskId.value = ''
  }
}

// ── 结果 ────────────────────────────────────────────────
const artifacts = computed(() =>
  runs.value.flatMap((run) =>
    run.artifacts.map((artifact) => ({ ...artifact, taskId: run.taskId, serviceName: run.serviceName, startedAtText: formatDateTime(run.startedAt) })),
  ),
)

function download(artifactName: string) {
  messageStore.info(t('algoWorkbench.mockDownload'))
  void artifactName
}

function copyContainerLog(lines: string[]) {
  void navigator.clipboard.writeText(lines.join('\n'))
  messageStore.success('容器日志已复制到剪贴板')
}

function scrollLogToEnd(element: unknown) {
  if (element instanceof HTMLElement) element.scrollTop = element.scrollHeight
}

const runsColumns = computed(() => [
  { title: t('algoWorkbench.colTask'), dataIndex: 'taskId', key: 'taskId', width: 180, odEllipsis: true, odSortable: true },
  { title: t('algoWorkbench.colService'), dataIndex: 'serviceName', key: 'serviceName', width: 180, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120, odSortable: true },
  { title: t('algoWorkbench.colStage'), dataIndex: 'stage', key: 'stage', width: 160, odEllipsis: true, odSortable: true },
  { title: t('algoWorkbench.colStarted'), dataIndex: 'startedAtText', key: 'startedAtText', width: 130, odSortable: true },
  { title: t('algoWorkbench.colDurationText'), dataIndex: 'duration', key: 'duration', width: 120, odSortable: true },
  { title: t('algoWorkbench.colActions'), key: 'actions', width: 120 },
])

const artifactColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name', odEllipsis: true, odSortable: true },
  { title: t('algoWorkbench.colService'), dataIndex: 'serviceName', key: 'serviceName', width: 180, odEllipsis: true, odSortable: true },
  { title: t('algoWorkbench.colTask'), dataIndex: 'taskId', key: 'taskId', width: 200, odEllipsis: true, odSortable: true },
  { title: t('common.updatedAt'), dataIndex: 'startedAtText', key: 'startedAtText', width: 200, odSortable: true },
  { title: t('algoWorkbench.colActions'), key: 'actions', width: 120 },
])

function onTabChange(tab: 'discover' | 'runs' | 'artifacts') {
  activeTab.value = tab
  if (tab === 'runs' && runs.value.length === 0) void loadRuns()
}

onMounted(() => {
  void loadServices()
  void loadCategories()
  if (activeTab.value !== 'discover') void loadRuns()
})
</script>

<template>
  <div class="algorithm-workbench-view">
    <a-card :bordered="false" class="wb-card">
      <a-tabs v-model:active-key="activeTab" @change="onTabChange">
        <a-tab-pane key="discover" :tab="t('algoWorkbench.tabDiscover')">
          <div class="category-row">
            <a-tag
              :color="selectedCategory === '' ? 'blue' : 'default'"
              class="cat-chip"
              @click="pickCategory('')"
            >
              {{ t('algoWorkbench.allCategories') }}
            </a-tag>
            <a-tag
              v-for="cat in categories"
              :key="cat"
              :color="selectedCategory === cat ? 'blue' : 'default'"
              class="cat-chip"
              @click="pickCategory(cat)"
            >
              {{ cat }}
            </a-tag>
          </div>
          <div class="toolbar">
            <a-input
              v-model:value="serviceQuery.keyword"
              :placeholder="t('algoWorkbench.searchPlaceholder')"
              style="width: 320px"
              allow-clear
              @press-enter="serviceQuery.page = 1; loadServices()"
            >
              <template #prefix><SearchOutlined style="color: #94a3b8" /></template>
            </a-input>
            <a-button type="primary" @click="serviceQuery.page = 1; loadServices()">
              {{ t('common.query') }}
            </a-button>
          </div>

          <ErrorState
            v-if="servicesError"
            :reason="servicesError"
            :next-step="t('common.loadNextStep')"
            :action-label="t('common.reload')"
            @retry="loadServices"
          />
          <SkeletonList v-else-if="servicesLoading" variant="cards" :rows="6" />
          <EmptyState
            v-else-if="services.length === 0"
            :title="t('algoWorkbench.emptyServices')"
            :description="t('algoWorkbench.emptyServicesDesc')"
          />
          <div v-else class="card-grid">
            <div v-for="service in services" :key="service.code" class="service-card">
              <div class="service-head">
                <h3 class="service-name" :title="service.name">{{ service.name }}</h3>
                <a-tag class="cat-badge">{{ service.category }}</a-tag>
                <a-tag color="blue" class="status-badge">{{ service.status }}</a-tag>
              </div>
              <p class="service-desc">{{ service.description }}</p>

              <div class="service-meta-grid">
                <div class="meta-box">
                  <span class="meta-label">{{ t('algoWorkbench.cardDuration') }}</span>
                  <span class="meta-val">
                    <ClockCircleOutlined />
                    {{ service.typicalDuration }}
                  </span>
                </div>
                <div class="meta-box">
                  <span class="meta-label">{{ t('algoWorkbench.cardRuns') }}</span>
                  <span class="meta-val">
                    <HistoryOutlined />
                    {{ service.runCount }}
                  </span>
                </div>
              </div>

              <div v-if="service.inputHint" class="service-input-hint">
                <span class="hint-label">{{ t('algoWorkbench.cardInput') }}:</span>
                <span class="hint-text">{{ service.inputHint }}</span>
              </div>

              <div class="service-actions">
                <a-button type="primary" class="run-btn" @click="openWizard(service.code)">
                  <template #icon><PlayCircleOutlined /></template>
                  {{ t('algoWorkbench.runNow') }}
                </a-button>
                <a-button @click="openDetail(service.code)">
                  {{ t('algoWorkbench.viewDetail') }}
                </a-button>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="runs" :tab="t('algoWorkbench.tabRuns')">
          <ErrorState
            v-if="runsError"
            :reason="runsError"
            :next-step="t('common.loadNextStep')"
            :action-label="t('common.reload')"
            @retry="loadRuns"
          />
          <SkeletonList v-else-if="runsLoading" variant="list" :rows="5" />
          <EmptyState
            v-else-if="runs.length === 0"
            :title="t('algoWorkbench.emptyRuns')"
            :description="t('algoWorkbench.emptyRunsDesc')"
          />
          <OdTable
            v-else
            v-model:expanded-row-keys="expandedTaskIds"
            :columns="runsColumns"
            :data-source="runs"
            :pagination="{ pageSize: 10 }"
            row-key="taskId"
            class="runs-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'taskId'">
                <span class="mono-code">{{ record.taskId }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status] ?? 'default'">{{ statusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space size="small">
                  <a-button
                    v-if="record.status === 'RUNNING'"
                    size="small"
                    danger
                    :loading="actionTaskId === record.taskId"
                    @click="confirmCancel(record.taskId)"
                  >
                    <template #icon><StopOutlined /></template>
                    {{ t('algoWorkbench.cancel') }}
                  </a-button>
                  <a-button
                    v-if="record.status === 'FAILED' || record.status === 'CANCELLED'"
                    size="small"
                    :loading="actionTaskId === record.taskId"
                    @click="rerun(record.taskId)"
                  >
                    <template #icon><ReloadOutlined /></template>
                    {{ t('algoWorkbench.rerun') }}
                  </a-button>
                </a-space>
              </template>
            </template>
            <template #expandedRowRender="{ record }">
              <div class="run-expand">
                <a-alert
                  v-if="record.humanReason"
                  type="error"
                  show-icon
                  class="run-reason"
                  :message="t('algoWorkbench.reasonTitle')"
                  :description="`${record.humanReason}${record.fixHint ? ' ' + t('algoWorkbench.fixHintTitle') + '：' + record.fixHint : ''}`"
                />
                <a-timeline class="run-nodes">
                  <a-timeline-item
                    v-for="node in record.nodes"
                    :key="node.name"
                    :color="node.state === 'SUCCEEDED' ? 'green' : node.state === 'RUNNING' ? 'blue' : node.state === 'FAILED' ? 'red' : 'gray'"
                  >
                    <span class="node-name">{{ node.name }}</span>
                    <a-tag :color="statusColor[node.state] ?? 'default'" class="node-state">
                      {{ statusText(node.state) }}
                    </a-tag>
                    <p v-if="node.humanReason" class="node-reason">{{ node.humanReason }}</p>
                  </a-timeline-item>
                </a-timeline>
                <div v-if="record.container" class="container-panel">
                  <div class="container-title">{{ t('algoWorkbench.containerTitle') }}</div>
                  <a-descriptions :column="3" size="small">
                    <a-descriptions-item :label="t('algoWorkbench.containerId')">
                      <span class="mono-code">{{ record.container.containerId }}</span>
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('algoWorkbench.image')">{{ record.container.image }}</a-descriptions-item>
                    <a-descriptions-item :label="t('algoWorkbench.node')">{{ record.container.node }}</a-descriptions-item>
                    <a-descriptions-item :label="t('common.status')">
                      <a-tag :color="record.container.state === 'RUNNING' ? 'processing' : record.container.state === 'FAILED' ? 'error' : 'default'">
                        {{ record.container.state }}
                      </a-tag>
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('algoWorkbench.cpu')">{{ record.container.cpu }}</a-descriptions-item>
                    <a-descriptions-item :label="t('algoWorkbench.mem')">{{ record.container.mem }}</a-descriptions-item>
                  </a-descriptions>
                  <div v-if="record.container.logTail.length" class="container-log-wrap">
                    <div class="container-log-head">
                      <span>最近日志（自动定位到末尾）</span>
                      <a-button size="small" type="link" @click="copyContainerLog(record.container.logTail)">
                        <template #icon><CopyOutlined /></template>
                        复制
                      </a-button>
                    </div>
                    <pre :ref="scrollLogToEnd" class="container-log">{{ record.container.logTail.join('\n') }}</pre>
                  </div>
                </div>
              </div>
            </template>
          </OdTable>
        </a-tab-pane>

        <a-tab-pane key="artifacts" :tab="t('algoWorkbench.tabArtifacts')">
          <EmptyState
            v-if="artifacts.length === 0"
            :title="t('algoWorkbench.emptyArtifacts')"
            :description="t('algoWorkbench.emptyArtifactsDesc')"
          />
          <OdTable
            v-else
            :columns="artifactColumns"
            :data-source="artifacts"
            :pagination="{ pageSize: 10 }"
            row-key="name"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'taskId'">
                <span class="mono-code">{{ record.taskId }}</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-button size="small" type="primary" ghost @click="download(record.name)">
                  <template #icon><DownloadOutlined /></template>
                  {{ t('algoWorkbench.download') }}
                </a-button>
              </template>
            </template>
          </OdTable>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<style scoped>
.wb-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.category-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.cat-chip {
  cursor: pointer;
  font-size: 12px;
  padding: 2px 10px;
  user-select: none;
}

.cat-badge {
  font-size: 11px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
  padding: 18px;
  background: #ffffff;
  box-shadow: var(--od-shadow-xs);
  transition: all 0.2s ease;
}

.service-card:hover {
  border-color: var(--od-primary-300, #93c5fd);
  box-shadow: var(--od-shadow-2);
  transform: translateY(-2px);
}

.service-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.service-name {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}

.service-desc {
  margin: 0;
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
  line-height: 1.5;
  min-height: 40px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.service-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.meta-box {
  background: var(--od-gray-50, #f8fafc);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.meta-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--od-gray-800, #1e293b);
  display: flex;
  align-items: center;
  gap: 4px;
}

.service-input-hint {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint-label {
  font-weight: 600;
  margin-right: 4px;
}

.service-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.run-btn {
  font-weight: 600;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.run-expand {
  display: grid;
  gap: 12px;
  padding: 8px 12px;
  background: var(--od-gray-50, #f8fafc);
  border-radius: 8px;
}

.run-reason {
  margin: 0;
  border-radius: 6px;
}

.node-name {
  font-weight: 600;
}

.node-state {
  margin-left: 8px;
}

.node-reason {
  margin: 4px 0 0;
  color: var(--od-color-blocked, #dc2626);
  font-size: 12px;
}

.container-panel {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.container-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--od-gray-800, #1e293b);
}

.container-log {
  margin: 10px 0 0;
  padding: 8px 10px;
  background: var(--od-gray-50, #f8fafc);
  border-radius: 6px;
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
  color: var(--od-gray-700, #334155);
  white-space: pre-wrap;
}

.container-log-wrap {
  margin-top: 12px;
}

.container-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
}
</style>
