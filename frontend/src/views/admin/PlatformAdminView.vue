<script setup lang="ts">
import { ClearOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { platformApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ProjectionRebuildSummary, RetentionCleanupResult, RetentionStatus } from '@/types/portal'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t } = useI18n()
const messageStore = useMessageStore()

const rebuilding = ref(false)
const rebuildResult = ref<ProjectionRebuildSummary | null>(null)
const statusLoading = ref(false)
const status = ref<RetentionStatus | null>(null)
const cleaning = ref(false)
const cleanupResult = ref<RetentionCleanupResult | null>(null)

async function rebuild() {
  rebuilding.value = true
  try {
    rebuildResult.value = await platformApi.rebuildProjections()
    messageStore.success(t('admin.rebuildSuccess'))
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    rebuilding.value = false
  }
}

async function loadStatus() {
  statusLoading.value = true
  try {
    status.value = await platformApi.retentionStatus()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    statusLoading.value = false
  }
}

async function cleanup(dryRun: boolean) {
  cleaning.value = true
  try {
    cleanupResult.value = await platformApi.retentionCleanup(dryRun)
    messageStore.success(t(dryRun ? 'admin.cleanupDryRunSuccess' : 'admin.cleanupSuccess'))
    if (!dryRun) {
      await loadStatus()
    }
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    cleaning.value = false
  }
}

void loadStatus()
</script>

<template>
  <div class="platform-admin-view">
    <PageHeader :eyebrow="t('menu.admin')" :title="t('menu.adminPlatform')" />
    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('admin.rebuildTitle')" class="admin-card">
          <p class="card-desc">{{ t('admin.rebuildDesc') }}</p>
          <a-button type="primary" :loading="rebuilding" @click="rebuild">
            <template #icon><ReloadOutlined /></template>
            {{ t('admin.rebuildAction') }}
          </a-button>
          <pre v-if="rebuildResult" class="result">{{ JSON.stringify(rebuildResult, null, 2) }}</pre>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('admin.retentionTitle')" :loading="statusLoading" class="admin-card">
          <p class="card-desc">{{ t('admin.retentionDesc') }}</p>
          <dl v-if="status" class="status-grid">
            <div class="status-box">
              <dt>{{ t('admin.retentionDays') }}</dt>
              <dd><strong>{{ status.retentionDays }} 天</strong></dd>
            </div>
            <div class="status-box">
              <dt>{{ t('admin.cutoffAt') }}</dt>
              <dd class="mono-text">{{ status.cutoffAt }}</dd>
            </div>
            <div class="status-box">
              <dt>{{ t('menu.tasks') }}</dt>
              <dd>{{ status.tasks }} 条</dd>
            </div>
            <div class="status-box">
              <dt>{{ t('menu.approvals') }}</dt>
              <dd>{{ status.approvals }} 条</dd>
            </div>
          </dl>
          <a-space style="margin-top: 14px">
            <a-button :loading="cleaning" @click="cleanup(true)">
              {{ t('admin.cleanupDryRun') }}
            </a-button>
            <a-button danger :loading="cleaning" @click="cleanup(false)">
              <template #icon><ClearOutlined /></template>
              {{ t('admin.cleanupExecute') }}
            </a-button>
          </a-space>
          <pre v-if="cleanupResult" class="result">{{ JSON.stringify(cleanupResult, null, 2) }}</pre>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.platform-admin-view {
  display: flex;
  flex-direction: column;
}

.admin-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.card-desc {
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 16px;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 14px 0;
}

.status-box {
  background: var(--od-gray-50, #f8fafc);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
}

.status-box dt {
  font-size: 12px;
  color: var(--od-gray-400, #94a3b8);
  margin-bottom: 4px;
}

.status-box dd {
  margin: 0;
  font-size: 14px;
  color: var(--od-gray-800, #1e293b);
}

.mono-text {
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
}

.result {
  margin-top: 16px;
  font-size: 12px;
  background: var(--od-gray-50, #f8fafc);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  font-family: var(--od-font-mono, monospace);
  max-height: 200px;
  overflow: auto;
}
</style>
