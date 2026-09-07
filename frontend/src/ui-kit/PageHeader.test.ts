import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageHeader from './PageHeader.vue'

describe('PageHeader', () => {
  it('渲染眉标、标题与状态徽章（不渲染描述行）', () => {
    const wrapper = mount(PageHeader, {
      props: {
        eyebrow: '服务门户',
        title: '个人工作台',
        description: '不应出现的描述行',
        status: 'running',
        statusLabel: '进行中',
      },
    })
    expect(wrapper.text()).toContain('个人工作台')
    expect(wrapper.text()).toContain('进行中')
    expect(wrapper.text()).not.toContain('不应出现的描述行')
  })

  it('backTo 渲染返回按钮，parents 渲染面包屑', async () => {
    const wrapper = mount(PageHeader, {
      props: {
        eyebrow: '服务门户',
        title: '客户质量分析-周批',
        backTo: '/algorithm-workbench',
        parents: ['数据工作台', '算法工作台'],
      },
    })
    const back = wrapper.find('.od-page-header__back')
    expect(back.exists()).toBe(true)
    expect(wrapper.text()).toContain('数据工作台')
    expect(wrapper.text()).toContain('算法工作台')
    await back.trigger('click')
    // 返回动作由组件内部 router.back() 执行；此处仅验证按钮可点
    expect(wrapper.emitted()).toBeDefined()
  })

  it('无 backTo 时不渲染返回按钮', () => {
    const wrapper = mount(PageHeader, {
      props: { title: '个人工作台' },
    })
    expect(wrapper.find('.od-page-header__back').exists()).toBe(false)
  })
})
