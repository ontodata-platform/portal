import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import HomeView from './HomeView.vue'

const pushMock = vi.fn()
const getHomeDataMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/content', () => ({
  contentApi: {
    getHomeData: (...args: unknown[]) => getHomeDataMock(...args),
  },
}))

// 与既有视图测试一致：antd 组件以轻桩替换，聚焦交互断言。
const stubs = {
  'a-input': {
    props: ['value', 'placeholder', 'size'],
    emits: ['update:value', 'press-enter'],
    template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" @keydown.enter="$emit(\'press-enter\')" />',
  },
  'a-button': { props: ['type', 'size'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot name="icon" /><slot /></button>' },
  'a-tag': { template: '<span><slot /></span>' },
}

const homeFixture = {
  greetingName: '陈晓',
  notices: [
    { code: 'ntc-001', title: '东海港区目标特性提取批次已开放', content: '', section: '公告', publishedAt: '2026-09-10T02:00:00.000Z' },
    { code: 'ntc-002', title: '遥感数据服务目录更新', content: '', section: '服务动态', publishedAt: '2026-09-09T02:00:00.000Z' },
  ],
  entries: [
    { code: 'data-workbench', title: '数据工作台', description: '浏览目录、申请数据服务', route: '/data-workbench', icon: 'database' as const },
  ],
  todo: { pendingApprovals: 4, runningTasks: 2, openRequirements: 3, unread: 1 },
}

function mountView() {
  return mount(HomeView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('HomeView（B1 首页）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHomeDataMock.mockResolvedValue(homeFixture)
  })

  it('渲染问候、待办聚合、公告与推荐位四区', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('陈晓')
    expect(wrapper.text()).toContain('待我审批')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('东海港区目标特性提取批次已开放')
    expect(wrapper.text()).toContain('推荐服务')
    expect(wrapper.text()).toContain('数据工作台')
  })

  it('待办格点击直达对应签页', async () => {
    const wrapper = mountView()
    await flushPromises()

    const metric = wrapper.findAll('.todo-metric').find((node) => node.text().includes('待我审批'))
    await metric!.trigger('click')

    expect(pushMock).toHaveBeenCalledWith('/personal/approvals')
  })

  it('推荐位与快捷提问可导航', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.entry-card').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/data-workbench')

    await wrapper.find('input').setValue('找数据服务')
    await wrapper.find('.hero-ask button').trigger('click')
    expect(pushMock).toHaveBeenLastCalledWith({ path: '/assistant', query: { q: '找数据服务' } })
  })

  it('加载失败展示错误态并可重试', async () => {
    getHomeDataMock.mockRejectedValueOnce(new Error('内容服务不可用'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('内容服务不可用')
    expect(getHomeDataMock).toHaveBeenCalledTimes(1)

    const retry = wrapper.findAll('button').find((button) => button.text().includes('重新加载'))
    expect(retry).toBeTruthy()
    await retry!.trigger('click')
    await flushPromises()
    expect(getHomeDataMock).toHaveBeenCalledTimes(2)
  })
})
