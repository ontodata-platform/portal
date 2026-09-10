<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { dataWorkbenchApi, type DatasetDetail } from '@/api/data-workbench'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import DescriptorRenderer from '@/components/descriptor/DescriptorRenderer.vue'
import { useMessageStore } from '@/stores/message'
import type { ApplicationSummary, ApplyTarget } from '@/types/application'
import type { DescriptorAction } from '@/types/descriptor'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const route = useRoute()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const loadError = ref('')
const dataset = ref<DatasetDetail | null>(null)
const applyOpen = ref(false)
const lastApplication = ref<ApplicationSummary | null>(null)

const applyTargets = computed<ApplyTarget[]>(() => {
  if (!dataset.value) return []
  const fields = dataset.value.descriptor.sections
    .find((section) => section.type === 'fields')
    ?.fields?.map((field) => field.label)
  return [{
    code: dataset.value.code,
    name: dataset.value.name,
    source: 'DATASET',
    fields,
  }]
})

async function load() {
  if (!code.value) return
  loading.value = true
  loadError.value = ''
  try {
    dataset.value = await dataWorkbenchApi.findDataset(code.value)
  } catch (error) {
    loadError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function scrollToSample() {
  document.getElementById('descriptor-sample')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onAction(action: DescriptorAction) {
  if (action.id === 'apply' || action.flow === 'apply') {
    applyOpen.value = true
    return
  }
  if (action.id === 'preview') {
    scrollToSample()
  }
}

function onApplied(apps: ApplicationSummary[]) {
  lastApplication.value = apps[apps.length - 1] ?? null
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      :title="dataset?.name ?? t('menu.marketplace')"
      back-to="/data-workbench"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="dataset-detail-card">
      <SkeletonList v-if="loading" variant="list" :rows="6" />
      <template v-else-if="dataset">
        <a-alert
          v-if="lastApplication"
          type="success"
          show-icon
          class="apply-banner"
          :message="t('dataWorkbench.applyBanner', { code: lastApplication.code })"
        >
          <template #action>
            <RouterLink to="/data-workbench?tab=applications">{{ t('dataWorkbench.viewApplications') }}</RouterLink>
          </template>
        </a-alert>
        <DescriptorRenderer :descriptor="dataset.descriptor" @action="onAction" />
      </template>
    </a-card>

    <ApplyWizardModal v-model:open="applyOpen" :targets="applyTargets" @submitted="onApplied" />
  </div>
</template>

<style scoped>
.dataset-detail-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.apply-banner {
  margin-bottom: 16px;
  border-radius: 8px;
}
</style>
