import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import { useMessageStore } from '@/stores/message'
import TaskSection from './TaskSection.vue'

const listMock = vi.fn()
const findMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/portal', () => ({
  taskApi: {
    list: (...args: unknown[]) => listMock(...args),
    find: (...args: unknown[]) => findMock(...args),
  },
}))

/** Ant Design Vue 组件在测试中需要全局 stub，避免依赖完整样式与挂载动画。 */
const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  // emits 必须声明：未声明 click 时父级 @click 会作为原生监听回落到根元素，与 $emit 双触发
  'a-button': { props: ['type', 'size', 'danger', 'disabled'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-select': { props: ['value'], emits: ['update:value'], template: '<select><slot /></select>' },
  'a-select-option': { template: '<option />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-progress': { props: ['percent', 'size'], template: '<div class="progress" />' },
  'a-modal': { props: ['open', 'title', 'footer', 'width'], template: '<div><slot /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { template: '<div><slot /></div>' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { TaskSection },
      template: '<TaskSection />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

describe('TaskSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({
      total: 1,
      items: [
        {
          taskId: 'task-100',
          taskType: 'DATA_INGEST',
          sourceSystem: 'data-platform',
          status: 'RUNNING',
          stage: 'LOAD',
          progress: 30,
          resourceRefs: ['ds-12345678'],
          resultRefs: [],
          updatedAt: '2026-08-14T12:00:00Z',
        },
      ],
    })
    findMock.mockResolvedValue({
      taskId: 'task-100',
      taskType: 'DATA_INGEST',
      sourceSystem: 'data-platform',
      status: 'RUNNING',
      stage: 'LOAD',
      progress: 30,
      resourceRefs: ['ds-12345678'],
      resultRefs: [],
      traceId: 'trace-1',
      updatedAt: '2026-08-14T12:00:00Z',
    })
  })

  it('挂载后加载任务列表（不带筛选参数时传 undefined）', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listMock).toHaveBeenCalledWith({
      page: 1,
      size: 20,
      status: undefined,
      domain: undefined,
      type: undefined,
    })
    expect(wrapper.text()).toContain('查询')
    expect(wrapper.text()).not.toContain('统一任务中心')
  })

  it('查询按钮按筛选条件重新加载并重置页码', async () => {
    const wrapper = mountView()
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const queryButton = buttons.find((button) => button.text().includes('查询'))
    await queryButton!.trigger('click')

    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('列表加载失败时上报错误而不抛出', async () => {
    const pinia = createPinia()
    listMock.mockRejectedValue({ response: { data: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: '服务处理失败', path: '/x' } } })
    const wrapper = mount(
      defineComponent({
        components: { TaskSection },
        template: '<TaskSection />',
      }),
      { global: { plugins: [pinia, i18n], stubs } },
    )
    await flushPromises()

    const store = useMessageStore(pinia)
    expect(store.feedback?.content).toContain('服务处理失败')
    expect(wrapper.text()).toContain('服务处理失败')
    expect(wrapper.text()).toContain('确认门户后端可用后重新加载')
  })

  it('空列表展示空态引导', async () => {
    listMock.mockResolvedValue({ total: 0, items: [] })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('还没有任务')
  })
})
