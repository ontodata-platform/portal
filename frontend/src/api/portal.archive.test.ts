import { describe, expect, it } from 'vitest'

import * as portal from './portal'

describe('门户 API 封存（§A5-2）', () => {
  it('公开模块不再导出 scenarioApi / platformApi', () => {
    expect(portal).not.toHaveProperty('scenarioApi')
    expect(portal).not.toHaveProperty('platformApi')
  })
})
