/**
 * 首页内容配置（D4 内容运营）：推荐入口位的排序/启停管理。
 * localStorage 持久；portalMockApi /content/home 与 OperationsAdminView 共用此数据源。
 * 真实模式契约（对齐后端 T2-2）：GET/PUT /api/v1/operations/content-entries
 */

export interface ContentEntry {
  code: string
  title: string
  description: string
  route: string
  icon: 'database' | 'appstore' | 'robot' | 'file-done'
  enabled: boolean
}

const CONTENT_KEY = 'od-content-entries'

const DEFAULT_ENTRIES: ContentEntry[] = [
  { code: 'data-workbench', title: '数据工作台', description: '浏览目录、申请数据服务与订阅交付', route: '/data-workbench', icon: 'database', enabled: true },
  { code: 'algorithm-workbench', title: '算法工作台', description: '运行已发布算法并查看结果', route: '/algorithm-workbench', icon: 'appstore', enabled: true },
  { code: 'assistant', title: '智能服务', description: '找数据、跑分析、看待办，一句话说清楚', route: '/assistant', icon: 'robot', enabled: true },
  { code: 'personal-results', title: '我的交付结果', description: '在线预览、领取与下载交付文件', route: '/personal/results', icon: 'file-done', enabled: true },
]

export function loadContentEntries(): ContentEntry[] {
  try {
    const raw = localStorage.getItem(CONTENT_KEY)
    if (!raw) return DEFAULT_ENTRIES.map((item) => ({ ...item }))
    const parsed = JSON.parse(raw) as ContentEntry[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ENTRIES.map((item) => ({ ...item }))
  } catch {
    return DEFAULT_ENTRIES.map((item) => ({ ...item }))
  }
}

export function saveContentEntries(entries: ContentEntry[]): void {
  try {
    localStorage.setItem(CONTENT_KEY, JSON.stringify(entries))
  } catch {
    /* 仅内存态 */
  }
}
