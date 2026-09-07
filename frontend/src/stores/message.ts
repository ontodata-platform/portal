/**
 * 全局消息 store：统一承载各页面操作反馈与后端错误（含 traceId 对账提示）。
 * 视图层捕获 ApiError 后调用 reportError，布局组件以 a-alert 展示。
 */
import { defineStore } from 'pinia'

import { ApiError } from '@/api/client'

let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function resetFeedbackTimer(clear: () => void) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(clear, 4_500)
}

export interface FeedbackMessage {
  kind: 'success' | 'error' | 'info' | 'warning'
  content: string
  traceId?: string
}

export const useMessageStore = defineStore('message', {
  state: () => ({
    /** 当前展示的反馈（null 表示无）。 */
    feedback: null as FeedbackMessage | null,
  }),
  actions: {
    setFeedback(feedback: FeedbackMessage) {
      this.feedback = feedback
      resetFeedbackTimer(() => this.clear())
    },
    success(content: string) {
      this.setFeedback({ kind: 'success', content })
    },
    info(content: string) {
      this.setFeedback({ kind: 'info', content })
    },
    warning(content: string) {
      this.setFeedback({ kind: 'warning', content })
    },
    reportError(error: unknown) {
      const apiError = error instanceof ApiError ? error : ApiError.from(error)
      this.setFeedback({
        kind: 'error',
        content: apiError.detail,
        traceId: apiError.traceId,
      })
    },
    clear() {
      if (feedbackTimer) clearTimeout(feedbackTimer)
      feedbackTimer = undefined
      this.feedback = null
    },
  },
})
