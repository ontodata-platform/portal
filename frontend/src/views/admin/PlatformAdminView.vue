<script setup lang="ts">
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
  <div>
    <PageHeader :eyebrow="t('menu.admin')" :title="t('menu.adminPlatform')" :description="t('admin.platformDesc')" />
    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('admin.rebuildTitle')">
          <p>{{ t('admin.rebuildDesc') }}</p>
          <a-button type="primary" :loading="rebuilding" @click="rebuild">{{ t('admin.rebuildAction') }}</a-button>
          <pre v-if="rebuildResult" class="result">{{ JSON.stringify(rebuildResult, null, 2) }}</pre>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('admin.retentionTitle')" :loading="statusLoading">
          <p>{{ t('admin.retentionDesc') }}</p>
          <dl v-if="status" class="status">
            <div><dt>{{ t('admin.retentionDays') }}</dt><dd>{{ status.retentionDays }}</dd></div>
            <div><dt>{{ t('admin.cutoffAt') }}</dt><dd>{{ status.cutoffAt }}</dd></div>
            <div><dt>{{ t('menu.tasks') }}</dt><dd>{{ status.tasks }}</dd></div>
            <div><dt>{{ t('menu.approvals') }}</dt><dd>{{ status.approvals }}</dd></div>
          </dl>
          <a-space>
            <a-button :loading="cleaning" @click="cleanup(true)">{{ t('admin.cleanupDryRun') }}</a-button>
            <a-button danger :loading="cleaning" @click="cleanup(false)">{{ t('admin.cleanupExecute') }}</a-button>
          </a-space>
          <pre v-if="cleanupResult" class="result">{{ JSON.stringify(cleanupResult, null, 2) }}</pre>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.status {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}

.status div {
  display: flex;
  justify-content: space-between;
}

.result {
  margin-top: 12px;
  font-size: 12px;
  background: #f4f7fb;
  padding: 8px;
  border-radius: 8px;
}
</style>
