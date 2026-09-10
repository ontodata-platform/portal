/**
 * 审批配置（D1 简化版）：事项类型字典 + 表单字段 + 流程节点。
 * localStorage 持久（默认字典来自内置种子）；真实模式契约（对齐后端 T1-2）：
 *   GET/POST/PUT /api/v1/approval-config/types
 */

export interface ApprovalFormField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'select' | 'number'
  required: boolean
  options?: string[]
}

export interface ApprovalFlowNode {
  order: number
  name: string
  roleCodes: string[]
  slaHours: number
}

export interface ApprovalTypeDef {
  code: string
  name: string
  version: number
  formFields: ApprovalFormField[]
  flow: ApprovalFlowNode[]
}

const CONFIG_KEY = 'od-approval-config'

const DEFAULT_TYPES: ApprovalTypeDef[] = [
  {
    code: 'DATA_GRANT',
    name: '数据授权',
    version: 1,
    formFields: [
      { key: 'purpose', label: '使用目的', type: 'textarea', required: true },
      { key: 'region', label: '数据区域', type: 'text', required: true },
    ],
    flow: [
      { order: 1, name: '业务初审', roleCodes: ['data-manager'], slaHours: 24 },
      { order: 2, name: '授权复核', roleCodes: ['approval-approver'], slaHours: 48 },
    ],
  },
  {
    code: 'R4_TOOL_CALL',
    name: '工具服务开通',
    version: 1,
    formFields: [
      { key: 'tool', label: '工具名称', type: 'text', required: true },
      { key: 'reason', label: '开通理由', type: 'textarea', required: true },
    ],
    flow: [{ order: 1, name: '高风险复核', roleCodes: ['approval-approver'], slaHours: 12 }],
  },
  {
    code: 'SYSTEM_PERMISSION',
    name: '系统权限',
    version: 1,
    formFields: [{ key: 'reason', label: '申请理由', type: 'textarea', required: true }],
    flow: [{ order: 1, name: '门户运营审核', roleCodes: ['operator'], slaHours: 24 }],
  },
]

export function loadApprovalTypes(): ApprovalTypeDef[] {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return DEFAULT_TYPES.map((item) => structuredClone(item))
    const parsed = JSON.parse(raw) as ApprovalTypeDef[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TYPES.map((item) => structuredClone(item))
  } catch {
    return DEFAULT_TYPES.map((item) => structuredClone(item))
  }
}

export function saveApprovalTypes(types: ApprovalTypeDef[]): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(types))
  } catch {
    /* 存储不可用时仅内存态 */
  }
}

export { DEFAULT_TYPES as DEFAULT_APPROVAL_TYPES }
