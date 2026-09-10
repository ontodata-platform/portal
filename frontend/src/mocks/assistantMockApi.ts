import type { IntentSuggestion } from '@/types/assistant'

import { resetAssistantContext, runAssistantTemplates } from './assistant/engine'
import { seedIntents } from './seed'

export { resetAssistantContext }

export function listIntentSuggestions(): IntentSuggestion[] {
  return seedIntents.map((item) => ({ ...item }))
}

/**
 * 应答入口（A7 改造）：正则罐头已替换为 assistant/engine 模板引擎——
 * 七套意图模板 + 单号直查 + 一轮上下文，应答从 seed 现查现组。
 */
export function routeAssistantIntent(text: string) {
  return runAssistantTemplates(text)
}

export async function streamAssistantText(
  text: string,
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (import.meta.env.VITEST) {
    onToken(text)
    return
  }
  for (const ch of text) {
    if (signal?.aborted) return
    onToken(ch)
    await new Promise((resolve) => setTimeout(resolve, 35))
  }
}
