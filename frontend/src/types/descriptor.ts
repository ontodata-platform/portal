/**
 * 服务详情描述符契约（门户智能化整改方案 v4 §2.2）。
 * 内容与呈现结构由供给平台（数据中台/算法重组）定义，门户只承载渲染。
 * 未知区块类型一律降级为只读文本块，保证前向兼容（永不白屏）。
 */

export type DescriptorSectionType =
  | 'summary'
  | 'fields'
  | 'richtext'
  | 'sample'
  | 'quality'
  | 'versions'
  | 'inputs'
  | 'outputs'
  | 'semantic-deps'
  | 'history'
  // 兜底：允许供给平台扩展新类型，渲染器降级处理
  | (string & {})

export interface DescriptorField {
  label: string
  value: string
}

export interface DescriptorSample {
  columns: string[]
  rows: string[][]
  note?: string
}

export interface DescriptorQualityMetric {
  label: string
  value: string
  state?: 'success' | 'warning' | 'blocked'
}

export interface DescriptorVersion {
  version: string
  releasedAt: string
  note?: string
  current?: boolean
}

export interface DescriptorInputOption {
  label: string
  value: string
}

/** 运行向导输入声明：dataset-ref 表示"从我的订阅与交付中选择"，其余为标量控件 */
export interface DescriptorInput {
  key: string
  label: string
  kind: 'dataset-ref' | 'text' | 'number' | 'date' | 'select'
  required?: boolean
  hint?: string
  defaultValue?: string
  options?: DescriptorInputOption[]
}

export interface DescriptorSection {
  type: DescriptorSectionType
  title?: string
  /** summary/fields */
  fields?: DescriptorField[]
  /** richtext / 未知类型兜底 */
  text?: string
  /** sample */
  sample?: DescriptorSample
  /** quality */
  metrics?: DescriptorQualityMetric[]
  /** versions */
  versions?: DescriptorVersion[]
  /** inputs（运行向导动态表单数据源） */
  inputs?: DescriptorInput[]
  /** outputs / semantic-deps 通用条目 */
  items?: DescriptorField[]
  /** history */
  stats?: DescriptorField[]
}

export interface DescriptorAction {
  id: string
  label: string
  kind: 'flow' | 'navigate'
  /** navigate 目标路由；flow：apply=申请使用、run=进入运行向导 */
  flow?: 'apply' | 'run'
  target?: string
}

export interface ServiceDescriptor {
  schemaVersion: string
  serviceType: 'data-service' | 'algorithm-service'
  provider: string
  code: string
  name: string
  summary: {
    version?: string
    status?: string
    badges?: string[]
  }
  sections: DescriptorSection[]
  actions: DescriptorAction[]
}

/** 供发现页卡片使用的摘要投影 */
export interface AlgorithmServiceSummary {
  code: string
  name: string
  description: string
  inputHint: string
  typicalDuration: string
  runCount: number
  status: string
  badges: string[]
}

/** 我的运行（算法工作台） */
export interface AlgorithmRunNode {
  name: string
  state: 'SUCCEEDED' | 'RUNNING' | 'PENDING' | 'FAILED' | 'CANCELLED'
  startedAt?: string
  finishedAt?: string
  humanReason?: string
  fixHint?: string
}

export interface AlgorithmRun {
  taskId: string
  serviceCode: string
  serviceName: string
  status: 'SUCCEEDED' | 'RUNNING' | 'FAILED' | 'CANCELLED' | 'BLOCKED'
  stage: string
  startedAt: string
  duration: string
  humanReason?: string
  fixHint?: string
  nodes: AlgorithmRunNode[]
  artifacts: Array<{ name: string; kind: string; size: string }>
}

/** 我的订阅交付（运行向导 dataset-ref 的选项来源；L2 由 D-1 聚合接口提供） */
export interface MyDelivery {
  serviceCode: string
  serviceName: string
  version: string
  snapshotDate: string
  expiresAt: string
  state: 'ACTIVE' | 'EXPIRING' | 'REVOKED'
}
