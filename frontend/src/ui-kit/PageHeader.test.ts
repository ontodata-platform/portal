import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageHeader from './PageHeader.vue'

describe('PageHeader', () => {
  it('renders title, description and status', () => {
    const wrapper = mount(PageHeader, {
      props: {
        eyebrow: '服务门户',
        title: '个人工作台',
        description: '先看待办',
        status: 'running',
        statusLabel: '进行中',
      },
    })
    expect(wrapper.text()).toContain('个人工作台')
    expect(wrapper.text()).toContain('先看待办')
    expect(wrapper.text()).toContain('进行中')
  })
})
