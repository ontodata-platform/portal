import { describe, expect, it } from 'vitest'

import { bindingAliasSet, buildPresentation } from './scenarioPresentation'

describe('scenarioPresentation', () => {
  it('无入口视图且无组件时省略展示配置', () => {
    expect(buildPresentation('', [], new Set())).toBeUndefined()
    expect(buildPresentation('   ', [], bindingAliasSet([{ alias: 'flow' }]))).toBeUndefined()
  })

  it('只填入口视图时不强制组件', () => {
    expect(buildPresentation('scenario-overview', [], new Set())).toEqual({
      entryView: 'scenario-overview',
      widgets: undefined,
    })
  })

  it('组件别名必须指向已有绑定别名', () => {
    const aliases = bindingAliasSet([{ alias: 'flow' }, { alias: '  customer  ' }, { alias: '' }])
    expect(aliases).toEqual(new Set(['flow', 'customer']))

    expect(buildPresentation('', [{ kind: 'TABLE', bindingAlias: 'flow' }], aliases)).toEqual({
      entryView: undefined,
      widgets: [{ kind: 'TABLE', bindingAlias: 'flow' }],
    })

    expect(() => buildPresentation('', [{ kind: 'CHART', bindingAlias: '' }], aliases)).toThrow(
      'WIDGET_ALIAS_REQUIRED',
    )
    expect(() =>
      buildPresentation('', [{ kind: 'METRIC', bindingAlias: 'ghost' }], aliases),
    ).toThrow('WIDGET_ALIAS_UNKNOWN:ghost')
  })
})
