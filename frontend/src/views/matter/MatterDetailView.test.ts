import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { matterApi } from '@/api/matter'
import MatterDetailView from './MatterDetailView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { type: 'approval', code: 'apr-0201' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/matter', () => ({
  matterApi: {
    getMatter: vi.fn(),
  },
}))

const matterFixture = {
  kind: 'approval',
  code: 'apr-0201',
  title: '海表温度场订阅申请',
  status: 'PENDING',
  slaStatus: 'ON_TIME',
  requester: '周研',
  detail: { serviceCode: 'ds-sst-field' },
  timeline: [
    { time: '2026-09-10T08:00:00.000Z', title: '登记/受理', state: 'done' },
    { time: '2026-09-10T09:00:00.000Z', title: '最近审批动作', state: 'current' },
  ],
  actions: ['办理', '催办'],
}

const stubs = {
  PageHeader: {
    props: ['title', 'status', 'statusLabel', 'description'],
    template: '<header><h1>{{ title }}</h1><span class="status">{{ statusLabel }}</span><span class="desc">{{ description }}</span></header>',
  },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div class="desc-item">{{ label }}: <slot /></div>' },
  'a-timeline': { template: '<ul><slot /></ul>' },
  'a-timeline-item': { props: ['color'], template: '<li class="tl"><slot /></li>' },
}

describe('MatterDetailView（C1 统一事项详情）', () => {
  it('按路由单号加载并渲染状态/时间轴/补充信息', async () => {
    vi.mocked(matterApi.getMatter).mockResolvedValue(matterFixture as never)

    const wrapper = mount(MatterDetailView, {
      global: { plugins: [i18n], stubs },
    })
    await flushPromises()

    expect(matterApi.getMatter).toHaveBeenCalledWith('approval', 'apr-0201')
    expect(wrapper.text()).toContain('海表温度场订阅申请')
    expect(wrapper.findAll('.tl')).toHaveLength(2)
    expect(wrapper.text()).toContain('serviceCode')
  })

  it('加载失败展示错误态', async () => {
    vi.mocked(matterApi.getMatter).mockRejectedValueOnce(new Error('未找到对应单据'))
    const wrapper = mount(MatterDetailView, {
      global: { plugins: [i18n], stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('未找到对应单据')
  })
})
