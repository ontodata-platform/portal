export interface SeedDataService {
  code: string
  name: string
  version: string
  classification: string
  source: string
  subscribed: boolean
}

export interface SeedAlgorithm {
  code: string
  name: string
  kind: 'template' | 'capability'
  version: string
  status: string
}

export interface SeedDatasetField {
  name: string
  desc: string
}

export interface SeedDataset {
  code: string
  name: string
  domain: string
  classification: string
  version: string
  snapshotHoursAgo: number
  qualityPassRate: string
  status: 'ONLINE' | 'OFFLINE'
  description: string
  fieldSpecs: SeedDatasetField[]
  sampleColumns: string[]
  sampleRows: string[][]
}

export interface SeedDataApplication {
  code: string
  serviceCode: string
  serviceName: string
  status: 'SUBMITTED' | 'PENDING' | 'DELIVERED' | 'REJECTED'
  submittedHoursAgo: number
  deliveredHoursAgo?: number
  currentApprover?: string
  rejectReason?: string
  remark: string
}

export interface SeedDataSubscription {
  code: string
  serviceCode: string
  serviceName: string
  version: string
  snapshotHoursAgo: number
  expiresHoursAgo: number
  isExpiringSoon: boolean
  deliveryType: string
  rowsCount: number
  previewUrl?: string
}
