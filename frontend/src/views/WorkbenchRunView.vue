<script setup lang="ts">
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { workbenchApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import EmptyState from '@/ui-kit/EmptyState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

interface ResourceRefRow {
  key: string
  value: string
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const aggregation = ref<UpstreamAggregation | null>(null)
const template = ref<CatalogEntry | null>(null)

const submitting = ref(false)
const formError = ref('')

const form = reactive({
  templateVersion: 1,
  ontologyRuntimeContractVersion: '',
  dataSnapshotVersion: '',
  resourceRefRows: [{ key: '', value: '' }] as ResourceRefRow[],
})

async function loadTemplate() {
  if (!code.value) return
  loading.value = true
  try {
    const res = await workbenchApi.template(code.value)
    aggregation.value = res
    const entry = catalogItem(res, code.value)
    template.value = entry
    if (entry) {
      const parsedVer = parseInt(String(entry.currentVersion), 10)
      form.templateVersion = !isNaN(parsedVer) && parsedVer > 0 ? parsedVer : 1
    }
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function submitRun() {
  formError.value = ''

  if (form.ontologyRuntimeContractVersion.trim()) {
    if (!/^\d+\.\d+$/.test(form.ontologyRuntimeContractVersion.trim())) {
      formError.value = '本体运行契约版本必须符合 x.y 格式（例如 1.0）'
      return
    }
  }

  const resourceRefs: Record<string, unknown> = {}
  for (const row of form.resourceRefRows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    resourceRefs[key] = row.value.trim()
  }

  submitting.value = true
  try {
    const res = await workbenchApi.run(code.value, {
      templateVersion: form.templateVersion,
      ontologyRuntimeContractVersion: form.ontologyRuntimeContractVersion.trim() || undefined,
      dataSnapshotVersion: form.dataSnapshotVersion.trim() || undefined,
      resourceRefs: Object.keys(resourceRefs).length > 0 ? resourceRefs : undefined,
    })

    if (res.started) {
      messageStore.success(t('workbench.submitSuccess', { taskId: res.taskId }))
    } else {
      messageStore.info(t('workbench.submitNotStarted', { taskId: res.taskId }))
    }
    router.push('/tasks')
  } catch (error) {
    formError.value = error instanceof ApiError ? error.detail : String(error)
    messageStore.reportError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(loadTemplate)
</script>

<template>
  <div class="workbench-run-view">
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('workbench.runTitle')"
      :description="template?.name ?? t('workbench.runPageDesc')"
      :status="template ? 'running' : undefined"
      :status-label="template ? t('workbench.runReadyLabel') : undefined"
    />
    <a-card :bordered="false" class="run-card">
      <template #title>
        <a-space>
          <a-button type="link" @click="router.push('/workbench')">
            <template #icon><ArrowLeftOutlined /></template>
            {{ t('workbench.backToList') }}
          </a-button>
          <span class="run-title">{{ t('workbench.runTitle') }}</span>
        </a-space>
      </template>

      <a-spin :spinning="loading">
        <a-alert
          v-if="aggregation && !aggregation.available"
          type="warning"
          show-icon
          style="margin-bottom: 16px"
          :message="aggregation.message ?? t('workbench.templateUnavailable')"
          :description="t('workbench.templateDescription')"
        />

        <template v-if="template">
          <div class="template-header">
            <div>
              <h2 class="template-name">{{ template.name }}</h2>
              <a-space>
                <a-tag color="blue">{{ template.code }}</a-tag>
                <a-tag :color="template.status === 'PUBLISHED' || template.status === 'ONLINE' ? 'success' : 'default'">
                  {{ template.status }}
                </a-tag>
                <a-tag color="purple">v{{ template.currentVersion }}</a-tag>
              </a-space>
            </div>
          </div>

          <a-divider />

          <a-alert
            v-if="formError"
            type="error"
            show-icon
            style="margin-bottom: 16px"
            :message="formError"
          />

          <a-form layout="vertical" class="run-form" @submit.prevent="submitRun">
            <a-form-item :label="t('workbench.templateVersion')" required>
              <a-input-number
                v-model:value="form.templateVersion"
                :min="1"
                style="width: 200px"
              />
            </a-form-item>

            <a-form-item
              :label="t('workbench.contractVersion')"
              extra="可选，若工作流依赖本体语义请指定契约版本（如 1.0）"
            >
              <a-input
                v-model:value="form.ontologyRuntimeContractVersion"
                :placeholder="t('workbench.contractVersionPlaceholder')"
                style="max-width: 360px"
              />
            </a-form-item>

            <a-form-item
              :label="t('workbench.snapshotVersion')"
              extra="可选，指定输入数据快照版本（如 snap-20260814）"
            >
              <a-input
                v-model:value="form.dataSnapshotVersion"
                :placeholder="t('workbench.snapshotVersionPlaceholder')"
                style="max-width: 360px"
              />
            </a-form-item>

            <a-form-item :label="t('workbench.resourceRefs')" :extra="t('workbench.resourceRefsHint')">
              <div v-for="(row, idx) in form.resourceRefRows" :key="idx" class="ref-row">
                <a-input v-model:value="row.key" :placeholder="t('workbench.resourceRefKey')" style="width: 200px" />
                <a-input v-model:value="row.value" :placeholder="t('workbench.resourceRefValue')" style="width: 280px" />
                <a-button
                  type="text"
                  danger
                  :disabled="form.resourceRefRows.length <= 1"
                  @click="form.resourceRefRows.splice(idx, 1)"
                >
                  {{ t('common.delete') }}
                </a-button>
              </div>
              <a-button type="dashed" @click="form.resourceRefRows.push({ key: '', value: '' })">
                {{ t('workbench.addResourceRef') }}
              </a-button>
            </a-form-item>

            <a-form-item style="margin-top: 24px">
              <a-space>
                <a-button
                  type="primary"
                  size="large"
                  html-type="submit"
                  :loading="submitting"
                  :disabled="!aggregation?.available"
                >
                  <template #icon><PlayCircleOutlined /></template>
                  {{ t('workbench.runButton') }}
                </a-button>
                <a-button size="large" @click="router.push('/workbench')">
                  {{ t('workbench.backToList') }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </template>
        <template v-else-if="!loading && aggregation?.available">
          <EmptyState
            :title="t('workbench.runEmptyTitle')"
            :description="t('workbench.runEmptyDesc')"
            :action-label="t('workbench.backToList')"
            @action="router.push('/workbench')"
          />
        </template>
      </a-spin>
    </a-card>
  </div>
</template>

<style scoped>
.run-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.run-title {
  font-size: 16px;
  font-weight: 600;
}

.template-header {
  margin-bottom: 8px;
}

.template-name {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.run-form {
  max-width: 800px;
}

.ref-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
