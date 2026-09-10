export interface ProductFieldSpec {
  name: string
  type: string
  desc: string
}

export interface ProductSample {
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface ProductDelivery {
  formats: string[]
  channel: string
  sla: string
}

export type ProductUpdateCycle = '日更' | '周更' | '月更' | '季更'

export interface ProductDescriptor {
  overview: string
  fieldSpecs: ProductFieldSpec[]
  sample: ProductSample
  updateCycle: ProductUpdateCycle
  applyRequirements: string[]
  delivery: ProductDelivery
}
