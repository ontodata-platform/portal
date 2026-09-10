import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import OdTable from './OdTable.vue'

const stubs = {
  'a-table': {
    props: ['columns', 'dataSource'],
    template: '<div class="table-stub" :data-class="columns.map((c) => c.className || \'\').join(\'|\')" />',
  },
  EmptyState: { template: '<div class="empty" />' },
}

function mountTable(columns: Array<Record<string, unknown>>) {
  return mount(OdTable, {
    props: {
      columns,
      dataSource: [{ code: 'req-002', title: '港区目标复核' }],
    },
    global: { plugins: [i18n], stubs },
  })
}

describe('OdTable', () => {
  it('mono 列给单元格套 cell-mono，并保留已有 className', () => {
    const wrapper = mountTable([
      { title: '编码', dataIndex: 'code', key: 'code', mono: true, className: 'keep-me' },
      { title: '标题', dataIndex: 'title', key: 'title' },
    ])
    const classes = wrapper.find('.table-stub').attributes('data-class') ?? ''
    expect(classes).toContain('cell-mono')
    expect(classes).toContain('keep-me')
    expect(classes.split('|')[1] ?? '').not.toContain('cell-mono')
  })
})
