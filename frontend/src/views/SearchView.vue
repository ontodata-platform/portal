<script setup lang="ts">
import { SearchOutlined } from '@ant-design/icons-vue'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { agentApi } from '@/api/agent'
import { useMessageStore } from '@/stores/message'
import type { CatalogSearchHit, CatalogSearchKind } from '@/types/agent'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const searched = ref(false)
const hits = ref<CatalogSearchHit[]>([])
const query = reactive<{ q: string; kind?: CatalogSearchKind }>({ q: '', kind: undefined })

const kindOptions = computed(() => [
  { value: 'data_asset', label: t('search.kind.data_asset') },
  { value: 'capability', label: t('search.kind.capability') },
  { value: 'workflow', label: t('search.kind.workflow') },
])

const kindColor: Record<string, string> = {
  data_asset: 'blue',
  capability: 'purple',
  workflow: 'cyan',
}

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function search() {
  const q = query.q.trim()
  if (!q) {
    searched.value = false
    hits.value = []
    loadError.value = ''
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await agentApi.catalogSearch({
      q,
      kind: query.kind,
      limit: 20,
    })
    hits.value = res.hits
    searched.value = true
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openHit(hit: Pick<CatalogSearchHit, 'kind' | 'id'>) {
  if (hit.kind === 'data_asset') {
    router.push(`/marketplace/${encodeURIComponent(hit.id)}`)
    return
  }
  if (hit.kind === 'workflow') {
    router.push(`/workbench/templates/${encodeURIComponent(hit.id)}`)
    return
  }
  router.push('/workbench')
}
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupCollab')"
      :title="t('menu.search')"
      :description="t('search.description')"
    />

    <a-card :bordered="false">
    <a-space wrap style="margin-bottom: 16px">
      <a-input-search
        v-model:value="query.q"
        :placeholder="t('search.placeholder')"
        style="width: 360px"
        enter-button
        @search="search"
      >
        <template #prefix>
          <SearchOutlined />
        </template>
      </a-input-search>
      <a-select
        v-model:value="query.kind"
        allow-clear
        style="width: 180px"
        :placeholder="t('search.kindPlaceholder')"
        :options="kindOptions"
      />
    </a-space>

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="search"
    />
    <EmptyState
      v-else-if="!searched && !loading"
      :title="t('search.emptyHint')"
    />
    <EmptyState
      v-else-if="searched && hits.length === 0 && !loading"
      :title="t('search.noHits')"
    />
    <a-list v-else :data-source="hits" :loading="loading">
      <template #renderItem="{ item }: { item: CatalogSearchHit }">
        <a-list-item class="hit-row" @click="openHit(item)">
          <a-list-item-meta :title="item.title" :description="item.snippet">
            <template #avatar>
              <a-tag :color="kindColor[item.kind]">{{ t(`search.kind.${item.kind}`) }}</a-tag>
            </template>
          </a-list-item-meta>
          <template #extra>
            <a-space>
              <a-tag>{{ item.classification }}</a-tag>
              <span class="source">{{ item.source }}</span>
            </a-space>
          </template>
        </a-list-item>
      </template>
    </a-list>
    </a-card>
  </div>
</template>

<style scoped>
.hit-row {
  cursor: pointer;
}

.source {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
