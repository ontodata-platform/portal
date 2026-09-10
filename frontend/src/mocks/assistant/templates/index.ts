import type { AssistantTemplate } from '../types'

import { algorithmTemplate } from './algorithm'
import { dataServiceTemplate } from './dataService'
import { fallbackTemplate } from './fallback'
import { notificationsTemplate } from './notifications'
import { processTemplate } from './process'
import { requirementTemplate } from './requirement'
import { todosTemplate } from './todos'

/**
 * 模板注册表：顺序即同分优先级。
 * 单号直查（apr-/req-/tsk-）在引擎层先于模板执行。
 */
export const templates: AssistantTemplate[] = [
  dataServiceTemplate,
  algorithmTemplate,
  requirementTemplate,
  todosTemplate,
  notificationsTemplate,
  processTemplate,
  fallbackTemplate,
]

export const fallback = fallbackTemplate
