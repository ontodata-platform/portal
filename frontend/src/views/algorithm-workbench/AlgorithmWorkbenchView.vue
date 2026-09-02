<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { algorithmWorkbenchApi } from '@/api/algorithm-workbench'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { useMessageStore } from '@/stores/message'
import type { AlgorithmRun, AlgorithmServiceSummary } from '@/types/descriptor'

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
const serviceQuery = reactive({ page: 1, size: 20, keyword: '' })

async function loadServices() {
  servicesLoading.value = true
  servicesError.value = ''
  try {
    const res = await algorithmWorkbenchApi.listServices({ ...serviceQuery })
    services.value = res.items
  } catch (error) {
    servicesError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    servicesLoading.value = false
  }
}

function openDetail(code: string) {
  router.push(`/algorithm-workbench/${encodeURIComponent(code)}`)
}

function openWizard(code: string) {
  router.push(`/algorithm-workbench/${encodeURIComponent(code)}/run`)
}

// ── 我的运行 ────────────────────────────────────────────
const runsLoading = ref(false)
const runsError = ref('')
const runs = ref<AlgorithmRun[]>([])
const expandedTaskIds = ref<string[]>([])

async function loadRuns() {
  runsLoading.value = true
  runsError.value = ''
  try {
    const res = await algorithmWorkbenchApi.listMyRuns({ page: 1, size: 50 })
    runs.value = res.items
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
  try {
    await algorithmWorkbenchApi.rerun(taskId)
    messageStore.success(t('algoWorkbench.rerun'))
    await loadRuns()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function cancel(taskId: string) {
  try {
    await algorithmWorkbenchApi.cancel(taskId)
    messageStore.info(t('algoWorkbench.statusCANCELLED'))
    await loadRuns()
  } catch (error) {
    messageStore.reportError(error)
  }
}

// ── 结果 ────────────────────────────────────────────────
const artifacts = computed(() =>
  runs.value.flatMap((run) =>
    run.artifacts.map((artifact) => ({ ...artifact, taskId: run.taskId, serviceName: run.serviceName, startedAt: run.startedAt })),
  ),
)

function download(artifactName: string) {
  messageStore.info(t('algoWorkbench.mockDownload'))
  void artifactName
}

const runsColumns = computed(() => [
  { title: t('algoWorkbench.colTask'), dataIndex: 'taskId', key: 'taskId' },
  { title: t('algoWorkbench.colService'), dataIndex: 'serviceName', key: 'serviceName' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('algoWorkbench.colStage'), dataIndex: 'stage', key: 'stage' },
  { title: t('algoWorkbench.colStarted'), dataIndex: 'startedAt', key: 'startedAt' },
  { title: t('algoWorkbench.colDurationText'), dataIndex: 'duration', key: 'duration' },
  { title: t('algoWorkbench.colActions'), key: 'actions' },
])

const artifactColumns = computed(() => [
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('algoWorkbench.colService'), dataIndex: 'serviceName', key: 'serviceName' },
  { title: t('algoWorkbench.colTask'), dataIndex: 'taskId', key: 'taskId' },
  { title: t('common.updatedAt'), dataIndex: 'startedAt', key: 'startedAt' },
  { title: t('algoWorkbench.colActions'), key: 'actions' },
])

function onTabChange(tab: 'discover' | 'runs' | 'artifacts') {
  activeTab.value = tab
  if (tab === 'runs' && runs.value.length === 0) void loadRuns()
}

onMounted(() => {
  void loadServices()
  if (activeTab.value !== 'discover') void loadRuns()
})
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('menu.algorithmWorkbench')"
      :description="t('algoWorkbench.pageDesc')"
    />

    <a-card :bordered="false" class="wb-card">
      <a-tabs v-model:active-key="activeTab" @change="onTabChange">
        <a-tab-pane key="discover" :tab="t('algoWorkbench.tabDiscover')">
          <div class="toolbar">
            <a-input-search
              v-model:value="serviceQuery.keyword"
              :placeholder="t('algoWorkbench.searchPlaceholder')"
              style="width: 360px"
              allow-clear
              @search="
                serviceQuery.page = 1;
                loadServices();
              "
            />
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
                <h3 class="service-name">{{ service.name }}</h3>
                <a-tag color="blue">{{ service.status }}</a-tag>
              </div>
              <p class="service-desc">{{ service.description }}</p>
              <dl class="service-meta">
                <div><dt>{{ t('algoWorkbench.cardInput') }}</dt><dd>{{ service.inputHint }}</dd></div>
                <div><dt>{{ t('algoWorkbench.cardDuration') }}</dt><dd>{{ service.typicalDuration }}</dd></div>
                <div><dt>{{ t('algoWorkbench.cardRuns') }}</dt><dd>{{ service.runCount }}</dd></div>
              </dl>
              <div class="service-actions">
                <a-button type="primary" size="small" @click="openWizard(service.code)">
                  {{ t('algoWorkbench.runNow') }}
                </a-button>
                <a-button size="small" @click="openDetail(service.code)">
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
          <a-table
            v-else
            :columns="runsColumns"
            :data-source="runs"
            :pagination="{ pageSize: 10 }"
            row-key="taskId"
            size="small"
            v-model:expanded-row-keys="expandedTaskIds"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status] ?? 'default'">{{ statusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space size="small">
                  <a-button
                    v-if="record.status === 'RUNNING'"
                    size="small"
                    danger
                    @click="cancel(record.taskId)"
                  >
                    {{ t('algoWorkbench.cancel') }}
                  </a-button>
                  <a-button
                    v-if="record.status === 'FAILED' || record.status === 'CANCELLED'"
                    size="small"
                    @click="rerun(record.taskId)"
                  >
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
              </div>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="artifacts" :tab="t('algoWorkbench.tabArtifacts')">
          <EmptyState
            v-if="artifacts.length === 0"
            :title="t('algoWorkbench.emptyArtifacts')"
            :description="t('algoWorkbench.emptyArtifactsDesc')"
          />
          <a-table
            v-else
            :columns="artifactColumns"
            :data-source="artifacts"
            :pagination="{ pageSize: 10 }"
            row-key="name"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'actions'">
                <a-button size="small" @click="download(record.name)">
                  {{ t('algoWorkbench.download') }}
                </a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<style scoped>
.wb-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--od-color-line-soft, #e8eef3);
  border-radius: var(--od-radius-card, 12px);
  padding: 16px;
  background: var(--od-color-panel, #fff);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.service-card:hover {
  box-shadow: 0 4px 14px rgba(16, 42, 67, 0.1);
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
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}

.service-desc {
  margin: 0;
  color: var(--od-color-ink-soft, #334e68);
  font-size: 13px;
  line-height: 1.6;
  min-height: 42px;
}

.service-meta {
  display: grid;
  gap: 4px;
  margin: 0;
}

.service-meta div {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.service-meta dt {
  flex: 0 0 auto;
  color: var(--od-color-muted, #52677a);
}

.service-meta dd {
  margin: 0;
  color: var(--od-color-ink-soft, #334e68);
}

.service-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
}

.run-expand {
  display: grid;
  gap: 12px;
}

.run-reason {
  margin: 0;
}

.node-name {
  font-weight: 600;
}

.node-state {
  margin-left: 8px;
}

.node-reason {
  margin: 4px 0 0;
  color: var(--od-color-blocked, #c53030);
  font-size: 12px;
}
</style>
