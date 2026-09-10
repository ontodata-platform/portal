export interface ApplyTarget {
  code: string
  name: string
  source: 'SERVICE' | 'DATASET'
  fields?: string[]
}

export interface ApplicationSummary {
  code: string
  status: string
  serviceCode: string
  serviceName: string
}
