import { describe, expect, it } from 'vitest'

import { productDescriptorOf } from './seed.products'
import { seedDataServices } from './seed'

describe('产品五要素 seed（§A3-1）', () => {
  it('12 个产品都具备五要素结构', () => {
    expect(seedDataServices.length).toBeGreaterThanOrEqual(12)
    for (const [index, service] of seedDataServices.entries()) {
      const descriptor = productDescriptorOf(service, index)
      expect(descriptor.overview.length).toBeGreaterThan(0)
      expect(descriptor.updateCycle).toMatch(/日更|周更|月更|季更/)
      expect(descriptor.applyRequirements.length).toBeGreaterThan(0)
      expect(descriptor.delivery.formats.length).toBeGreaterThan(0)
      expect(descriptor.delivery.channel.length).toBeGreaterThan(0)
      expect(descriptor.delivery.sla.length).toBeGreaterThan(0)
    }
  })

  it('历史归档产品字段与样例为空，用于空态验收', () => {
    const archive = seedDataServices.find((item) => item.code === 'ds-optical-archive')
    expect(archive).toBeTruthy()
    const descriptor = productDescriptorOf(archive!, seedDataServices.indexOf(archive!))
    expect(descriptor.fieldSpecs).toEqual([])
    expect(descriptor.sample.rows).toEqual([])
  })
})
