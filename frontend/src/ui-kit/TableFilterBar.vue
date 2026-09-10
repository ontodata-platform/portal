<script setup lang="ts">
/**
 * 统一筛选栏（A6-1）：筛选控件带可见标签（ux 基准 form-labels：占位符不能替代标签），
 * 标签点击可聚焦对应控件；查询按钮暂留，B2-2 换防抖即时过滤后移除。
 * query 为页面 reactive 查询对象，组件不改写它，变更经 update 事件由页面 Object.assign 回写。
 */
import { SearchOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

export interface TableFilterOption {
  label: string
  value: string
}

export interface TableFilterSpec {
  key: string
  label: string
  options: TableFilterOption[]
  width?: number
}

defineOptions({ name: 'TableFilterBar' })

const props = withDefaults(
  defineProps<{
    /** 页面 reactive 查询对象（只读使用；变更经 update 事件整体回写） */
    query: Record<string, string | number | undefined>
    filters: TableFilterSpec[]
    /** 关键字搜索框占位文案；不传则不渲染关键字输入 */
    searchPlaceholder?: string
    /** 关键字写入 query 的键名（如运营页的 section） */
    searchKey?: string
    /** 关键字字段标签；默认"关键字" */
    searchLabel?: string
    searchWidth?: number
    /** 查询按钮文案；默认"查询" */
    searchText?: string
  }>(),
  { searchPlaceholder: '', searchKey: 'keyword', searchLabel: '', searchWidth: 200, searchText: '' },
)

const emit = defineEmits<{
  (e: 'update', next: Record<string, string | number | undefined>): void
  (e: 'search'): void
}>()

const { t } = useI18n()

function set(key: string, value: string | number | undefined) {
  emit('update', { ...props.query, [key]: value })
}

function onSelect(key: string, value: unknown) {
  set(key, typeof value === 'string' || typeof value === 'number' ? value : undefined)
}

function onSearchInput(value: string | number) {
  set(props.searchKey, String(value ?? ''))
}

function keywordLabel() {
  return props.searchLabel || t('common.keyword')
}

function searchTextLabel() {
  return props.searchText || t('common.query')
}
</script>

<template>
  <div class="table-filter-bar">
    <div v-for="filter in filters" :key="filter.key" class="filter-field">
      <label class="filter-label" :for="`tfb-${filter.key}`">{{ filter.label }}</label>
      <a-select
        :id="`tfb-${filter.key}`"
        :value="query[filter.key] || undefined"
        :options="filter.options"
        allow-clear
        :placeholder="filter.label"
        :style="{ width: `${filter.width ?? 140}px` }"
        @change="onSelect(filter.key, $event)"
      />
    </div>
    <div v-if="searchPlaceholder" class="filter-field">
      <label class="filter-label" :for="`tfb-${searchKey}`">{{ keywordLabel() }}</label>
      <a-input
        :id="`tfb-${searchKey}`"
        :value="String(query[searchKey] ?? '')"
        :placeholder="searchPlaceholder"
        :style="{ width: `${searchWidth}px` }"
        allow-clear
        @update:value="onSearchInput"
        @press-enter="emit('search')"
      />
    </div>
    <div class="filter-field">
      <span class="filter-label" aria-hidden="true">&nbsp;</span>
      <a-button type="primary" @click="emit('search')">
        <template #icon><SearchOutlined /></template>
        {{ searchTextLabel() }}
      </a-button>
    </div>
    <slot name="append"></slot>
  </div>
</template>

<style scoped>
.table-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 16px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
