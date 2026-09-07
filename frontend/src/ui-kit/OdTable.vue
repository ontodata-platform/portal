<script setup lang="ts">
/**
 * 统一表格（UX-1 §10.1）：内置空态、分页规格、列默认溢出省略。
 * 列定义扩展：
 * - { odEllipsis?: boolean }：开启后单元格超出省略并带原生 title 提示；
 * - { odSortable?: boolean }：按 dataIndex 的显示值进行本地排序。
 * 其余 props/attrs/slots/事件全部透传 a-table（bodyCell 等插槽照常使用）。
 */
import { computed, useAttrs, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'

import EmptyState from '@/ui-kit/EmptyState.vue'

defineOptions({ name: 'OdTable', inheritAttrs: false })

const props = defineProps<{
  columns: Array<Record<string, unknown>>
  dataSource: unknown[]
  /** 同时兼容 Ant Design Vue 的字段型和函数型行键。 */
  rowKey?: string | ((record: never, index?: number) => string | number)
  loading?: boolean
  pagination?: false | {
    current?: number
    pageSize?: number
    total?: number
    hideOnSinglePage?: boolean
    showTotal?: (total: number, range?: [number, number]) => string
  }
  emptyTitle?: string
  emptyDescription?: string
}>()

const attrs = useAttrs()
const slots = useSlots()
const { t } = useI18n()

const hasData = computed(() => props.dataSource.length > 0)

/** 列默认补 odEllipsis（antd column.ellipsis 显示原生 title） */
const normalizedColumns = computed(() =>
  props.columns.map((column) => {
    const col = column as {
      odEllipsis?: boolean
      odSortable?: boolean
      ellipsis?: boolean | object
      sorter?: unknown
      dataIndex?: string
      [key: string]: unknown
    }
    const next = { ...col }
    if (col.odEllipsis && !col.ellipsis) next.ellipsis = { showTitle: true }
    if (col.odSortable && !col.sorter && col.dataIndex) {
      next.sorter = (left: Record<string, unknown>, right: Record<string, unknown>) =>
        String(left[col.dataIndex!] ?? '').localeCompare(String(right[col.dataIndex!] ?? ''), 'zh-CN', {
          numeric: true,
          sensitivity: 'base',
        })
    }
    return next
  }),
)

const paginationProps = computed(() => {
  if (props.pagination === false) return false
  return {
    showSizeChanger: false,
    showTotal: (total: number) => t('odTable.total', { total }),
    ...(props.pagination ?? {}),
  }
})

const tableProps = computed(() => ({
  ...attrs,
  columns: normalizedColumns.value,
  dataSource: props.dataSource,
  rowKey: props.rowKey ?? 'id',
  loading: props.loading,
  pagination: hasData.value ? paginationProps.value : false,
}))

const slotNames = Object.keys(slots)
</script>

<template>
  <EmptyState
    v-if="!loading && !hasData"
    :title="emptyTitle ?? t('odTable.emptyTitle')"
    :description="emptyDescription"
  />
  <a-table v-else v-bind="tableProps" size="small">
    <template v-for="name in slotNames" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}"></slot>
    </template>
  </a-table>
</template>

<style scoped>
:deep(.ant-table) {
  border-radius: 8px;
}
</style>
