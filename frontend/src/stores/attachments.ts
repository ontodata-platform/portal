import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 附件管理（D2）：localStorage 持久（元数据 + 内容 base64，演示上限 2MB/文件）。
 * 真实模式契约（对齐后端 T1-3）：
 *   POST /api/v1/attachments        multipart(file, bizType, bizCode)
 *   GET  /api/v1/attachments/{id}/download
 *   DELETE /api/v1/attachments/{id}
 */

export interface AttachmentRef {
  id: string
  bizType: string
  bizCode: string
  name: string
  size: number
  mime: string
  /** base64 内容（演示实现）；真实模式为受控存储引用 */
  dataUrl?: string
  uploadedAt: string
  expiresAt?: string
}

const ATTACHMENTS_KEY = 'od-attachments'
const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'application/zip', 'application/json']

function load(): AttachmentRef[] {
  try {
    const raw = localStorage.getItem(ATTACHMENTS_KEY)
    return raw ? (JSON.parse(raw) as AttachmentRef[]) : []
  } catch {
    return []
  }
}

function persist(items: AttachmentRef[]): void {
  try {
    localStorage.setItem(ATTACHMENTS_KEY, JSON.stringify(items))
  } catch {
    /* 超出配额时丢弃持久化，保留内存态 */
  }
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

export const useAttachmentsStore = defineStore('attachments', () => {
  const attachments = ref<AttachmentRef[]>(load())

  function listByBiz(bizType: string, bizCode: string): AttachmentRef[] {
    return attachments.value.filter((item) => item.bizType === bizType && item.bizCode === bizCode)
  }

  async function add(file: File, bizType: string, bizCode: string): Promise<AttachmentRef> {
    if (file.size > MAX_SIZE) throw new Error('附件不能超过 2MB')
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(csv|txt|pdf|zip|json)$/i)) {
      throw new Error('不支持的附件类型')
    }
    const dataUrl = file.size <= 512 * 1024 ? await toDataUrl(file) : undefined
    const item: AttachmentRef = {
      id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      bizType,
      bizCode,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      dataUrl,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600e3).toISOString(),
    }
    attachments.value = [item, ...attachments.value]
    persist(attachments.value)
    return item
  }

  function remove(id: string): void {
    attachments.value = attachments.value.filter((item) => item.id !== id)
    persist(attachments.value)
  }

  return { attachments, listByBiz, add, remove }
})
