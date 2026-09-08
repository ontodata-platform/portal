<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { agentApi } from '@/api/agent'
import type { CatalogSearchHit } from '@/types/agent'
import { 中文展示 } from '@/ui-kit/展示文本'

const props = defineProps<{ keyword?: string }>()
const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()
const router = useRouter()
const query = reactive({ q: props.keyword ?? '' })
const hits = ref<CatalogSearchHit[]>([])
const searched = ref(false)

async function search() {
  if (!query.q.trim()) return
  const res = await agentApi.catalogSearch({ q: query.q.trim(), limit: 20 })
  hits.value = res.hits
  searched.value = true
}

void search()
</script>

<template>
  <div class="degraded">
    <a-alert type="warning" show-icon :message="t('assistant.degradedBanner')">
      <template #action><a-button size="small" @click="emit('retry')">重试</a-button></template>
    </a-alert>
    <a-input-search
      v-model:value="query.q"
      :placeholder="t('assistant.searchPlaceholder')"
      enter-button
      style="margin: 16px 0"
      @search="search"
    />
    <a-list v-if="searched" :data-source="hits">
      <template #renderItem="{ item }">
        <a-list-item>{{ 中文展示(item.kind) }} · {{ item.id }}</a-list-item>
      </template>
    </a-list>
    <a-row :gutter="12" class="shortcuts">
      <a-col :span="6"><a-card hoverable @click="router.push('/data-workbench')">{{ t('menu.marketplace') }}</a-card></a-col>
      <a-col :span="6"><a-card hoverable @click="router.push('/algorithm-workbench')">{{ t('menu.algorithmWorkbench') }}</a-card></a-col>
      <a-col :span="6"><a-card hoverable @click="router.push('/personal')">{{ t('menu.personal') }}</a-card></a-col>
      <a-col :span="6"><a-card hoverable @click="router.push('/personal/tasks')">{{ t('menu.tasks') }}</a-card></a-col>
    </a-row>
  </div>
</template>
