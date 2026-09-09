import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import RequirementAdminView from './RequirementAdminView.vue'

const listMock = vi.fn()
const analyzeMock = vi.fn()
const assignMock = vi.fn()
const progressMock = vi.fn()
const completeMock = vi.fn()
const cancelMock = vi.fn()
const overlapCandidatesMock = vi.fn()
const consolidateMock = vi.fn()

vi.mock('@/api/portal', () => ({
  requirementApi: {
    list: (...args: unknown[]) => listMock(...args),
    analyze: (...args: unknown[]) => analyzeMock(...args),
    overlapCandidates: (...args: unknown[]) => overlapCandidatesMock(...args),
    consolidate: (...args: unknown[]) => consolidateMock(...args),
    assign: (...args: unknown[]) => assignMock(...args),
    progress: (...args: unknown[]) => progressMock(...args),
    complete: (...args: unknown[]) => completeMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
  },
}))

const stubs = {
  PageHeader: {
    props: ['eyebrow', 'title', 'description'],
    template: '<header class="page-header"><h1>{{ title }}</h1><p v-if="description" class="page-desc">{{ description }}</p></header>',
  },
  'a-card': { template: '<div><slot /></div>' },
  'a-table': {
    props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'],
    template:
      '<div class="table"><div v-for="record in dataSource" :key="record.code" class="table-row"><slot name="bodyCell" :column="{ key: \'code\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'action\' }" :record="record" /></div></div>',
  },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'danger', 'ghost'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-select': { props: ['value'], emits: ['update:value'], template: '<select :value="value"><slot /></select>' },
  'a-select-option': { template: '<option><slot /></option>' },
  'a-input': { props: ['value'], emits: ['update:value'], inheritAttrs: false, template: '<input v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-textarea': { props: ['value'], emits: ['update:value'], inheritAttrs: false, template: '<textarea v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-drawer': { props: ['open', 'title'], template: '<div v-if="open" class="drawer"><slot /><slot name="extra" /><slot name="footer" /></div>' },
  'a-modal': { props: ['open'], emits: ['ok'], template: '<section v-if="open" class="modal"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确认</button></section>' },
  'a-timeline': { template: '<ol class="timeline"><slot /></ol>' },
  'a-timeline-item': { props: ['color'], template: '<li><slot /></li>' },
  'a-divider': { template: '<div><slot /></div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label'], template: '<div><slot /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div><slot /></div>' },
}

const openItem = {
  code: 'req-002',
  requirementType: 'DATA',
  title: '高分辨率光学影像目标特性提取',
  requester: 'alice',
  status: 'OPEN',
  dataProfile: {
    businessDomain: '遥感目标识别',
    dataObject: '高分辨率光学卫星影像',
    scope: '东海重点海域',
    granularity: '0.5 米空间分辨率',
    fields: ['scene_id', 'acquisition_time', 'orbit_id'],
    useCase: '港区目标特性提取',
    sensitivity: 'INTERNAL',
  },
  createdAt: '2026-08-31T09:30:00.000Z',
  updatedAt: '2026-08-31T09:30:00.000Z',
}

function mountView() {
  return mount(RequirementAdminView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('RequirementAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({ total: 1, items: [openItem] })
    analyzeMock.mockResolvedValue({ ...openItem, status: 'ANALYZING' })
    consolidateMock.mockResolvedValue({ ...openItem, consolidation: { primaryCode: 'req-002', role: 'RELATED' } })
    overlapCandidatesMock.mockResolvedValue([
      { code: 'req-006', title: '东海港区目标特性识别影像需求', requester: 'bob', status: 'OPEN', score: 90, reasons: ['数据对象一致', '使用范围一致'] },
    ])
  })

  it('挂载后加载全量需求且不展示新建与页头说明', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listMock).toHaveBeenCalledWith({
      page: 1,
      size: 20,
      status: undefined,
      type: undefined,
      keyword: undefined,
    })
    expect(wrapper.text()).toContain('需求管理')
    expect(wrapper.text()).toContain('req-002')
    expect(wrapper.text()).not.toContain('登记需求')
    expect(wrapper.text()).not.toContain('新建需求')
    expect(wrapper.find('.page-desc').exists()).toBe(false)
  })

  it('办理抽屉只呈现当前步骤，并以分析事实和相似候选支持数据需求整合决策', async () => {
    const wrapper = mountView()
    await flushPromises()

    const handle = wrapper.findAll('button').find((button) => button.text().includes('办理'))
    expect(handle).toBeTruthy()
    await handle!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.drawer').exists()).toBe(true)
    expect(wrapper.text()).toContain('分析结论')
    expect(wrapper.find('[data-handling-panel="analysis"]').exists()).toBe(true)
    expect(wrapper.find('[data-handling-panel="assignment"]').exists()).toBe(false)
    expect(wrapper.find('[data-handling-target="overview"]').exists()).toBe(true)
    expect(overlapCandidatesMock).toHaveBeenCalledWith('req-002')
    expect(wrapper.text()).toContain('相似需求候选')
    expect(wrapper.text()).toContain('数据对象一致')
    expect(wrapper.findAll('button').find((button) => button.text() === '整合到当前需求')).toBeUndefined()

    await wrapper.find('textarea[name="analysisConclusion"]').setValue('可由高分辨率光学影像满足港区目标特性提取需求。')
    const analyze = wrapper.findAll('button').find((button) => button.text() === '提交分析')
    expect(analyze).toBeTruthy()
    await analyze!.trigger('click')
    await flushPromises()

    expect(analyzeMock).toHaveBeenCalledWith('req-002', {
      analysis: { conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', feasibility: 'FEASIBLE', priority: 'MEDIUM', risks: undefined },
    })
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('将候选需求整合到当前主需求时要求整合说明并保留明确方向', async () => {
    const analyzedItem = {
      ...openItem,
      status: 'ANALYZING',
      analysis: { conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', feasibility: 'FEASIBLE', priority: 'MEDIUM' },
    }
    listMock.mockResolvedValue({ total: 1, items: [analyzedItem] })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('办理'))!.trigger('click')
    await flushPromises()

    const consolidate = wrapper.findAll('button').find((button) => button.text() === '整合到当前需求')
    expect(consolidate).toBeTruthy()
    await consolidate!.trigger('click')
    await wrapper.find('textarea[name="consolidationReason"]').setValue('影像类型、覆盖海域和空间分辨率一致，统一组织交付。')
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(consolidateMock).toHaveBeenCalledWith('req-006', {
      primaryCode: 'req-002',
      reason: '影像类型、覆盖海域和空间分辨率一致，统一组织交付。',
    })
  })

  it('分派已分析需求时记录负责人、交付物、目标日期和里程碑', async () => {
    const analyzedItem = {
      ...openItem,
      status: 'ANALYZING',
      analysis: { conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', feasibility: 'FEASIBLE', priority: 'MEDIUM' },
    }
    listMock.mockResolvedValue({ total: 1, items: [analyzedItem] })
    assignMock.mockResolvedValue({ ...analyzedItem, status: 'ASSIGNED' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('办理'))!.trigger('click')
    await wrapper.find('[data-handling-target="assignment"]').trigger('click')
    await wrapper.find('input[name="planOwner"]').setValue('王工')
    await wrapper.find('input[name="planDeliverable"]').setValue('东海重点海域光学影像服务')
    await wrapper.find('input[name="planTargetDate"]').setValue('2026-09-30')
    await wrapper.find('textarea[name="planMilestones"]').setValue('字段确认后发布')
    await wrapper.findAll('button').find((button) => button.text() === '分派')!.trigger('click')
    await flushPromises()

    expect(assignMock).toHaveBeenCalledWith('req-002', {
      assigneeSystem: 'data-platform',
      assigneeRef: undefined,
      plan: {
        owner: '王工',
        deliverable: '东海重点海域光学影像服务',
        targetDate: '2026-09-30',
        milestones: '字段确认后发布',
      },
    })
  })

  it('登记进度时记录完成比例和处理说明，而不是仅改变状态', async () => {
    const assignedItem = {
      ...openItem,
      status: 'ASSIGNED',
      assigneeSystem: 'data-platform',
      plan: { owner: '王工', deliverable: '东海重点海域光学影像服务', targetDate: '2026-09-30' },
    }
    listMock.mockResolvedValue({ total: 1, items: [assignedItem] })
    progressMock.mockResolvedValue({ ...assignedItem, status: 'IN_PROGRESS' })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('办理'))!.trigger('click')
    await wrapper.find('input[name="progressPercent"]').setValue('40')
    await wrapper.find('textarea[name="progressNote"]').setValue('已完成影像时相与云量阈值确认。')
    await wrapper.findAll('button').find((button) => button.text() === '登记进度')!.trigger('click')
    await flushPromises()

    expect(progressMock).toHaveBeenCalledWith('req-002', {
      percent: 40,
      note: '已完成影像时相与云量阈值确认。',
    })
  })
})
