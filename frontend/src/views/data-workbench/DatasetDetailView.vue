<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { dataWorkbenchApi, type DatasetDetail } from '@/api/data-workbench'
import DescriptorRenderer from '@/components/descriptor/DescriptorRenderer.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { useMessageStore } from '@/stores/message'
import type { DescriptorAction } from '@/types/descriptor'

const { t } = useI18n()
const route = useRoute()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const loadError = ref('')
const dataset = ref<DatasetDetail | null>(null)

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

function onAction(action: DescriptorAction) {
  // 申请使用走数据服务申请流（演示环境给出提示）
  messageStore.info(action.label)
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="dataset?.name ?? t('menu.marketplace')"
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
        <DescriptorRenderer :descriptor="dataset.descriptor" @action="onAction" />
      </template>
    </a-card>
  </div>
</template>

<style scoped>
.dataset-detail-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
</style>
