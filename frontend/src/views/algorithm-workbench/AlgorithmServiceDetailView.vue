<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { algorithmWorkbenchApi, type AlgorithmServiceDetail } from '@/api/algorithm-workbench'
import DescriptorRenderer from '@/components/descriptor/DescriptorRenderer.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { 中文展示 } from '@/ui-kit/展示文本'
import { useMessageStore } from '@/stores/message'
import type { DescriptorAction } from '@/types/descriptor'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const loadError = ref('')
const service = ref<AlgorithmServiceDetail | null>(null)

async function load() {
  if (!code.value) return
  loading.value = true
  loadError.value = ''
  try {
    service.value = await algorithmWorkbenchApi.findService(code.value)
  } catch (error) {
    loadError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function onAction(action: DescriptorAction) {
  if (action.kind === 'navigate' && action.target) {
    router.push(action.target)
    return
  }
  if (action.flow === 'run') {
    router.push(`/algorithm-workbench/${encodeURIComponent(code.value)}/run`)
    return
  }
  messageStore.info(action.label)
}

onMounted(load)
</script>

<template>
  <div>
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="detail-card">
      <SkeletonList v-if="loading" variant="list" :rows="6" />
      <template v-else-if="service">
        <div class="detail-category">
          <a-tag color="geekblue" class="category-badge">{{ 中文展示(service.category) }}</a-tag>
        </div>
        <DescriptorRenderer :descriptor="service.descriptor" @action="onAction" />
      </template>
    </a-card>
  </div>
</template>

<style scoped>
.detail-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.detail-category {
  margin-bottom: 12px;
}

.category-badge {
  font-size: 12px;
}
</style>
