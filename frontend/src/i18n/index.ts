/**
 * 国际化实例（M5 国际化）：zh-CN 缺省 + en-US；语言持久化到 localStorage。
 * 语言切换对组件即时生效（legacy:false 组合式模式）；键结构一致性由 MessageSchema 类型保证。
 */
import { createI18n } from 'vue-i18n'

import { enUs, zhCn, type MessageSchema } from './messages'

export const LOCALE_STORAGE_KEY = 'ontodata.locale'
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export const DEFAULT_LOCALE = 'zh-CN'
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

function loadLocale(): string {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
      return stored
    }
  } catch {
    // localStorage 不可用时按缺省语言运行
  }
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: loadLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCn, 'en-US': enUs },
})

/** 切换语言：不支持的取值回退 zh-CN，返回实际生效语言。 */
export function setLocale(locale: string): SupportedLocale {
  const next: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as SupportedLocale)
    : DEFAULT_LOCALE
  i18n.global.locale.value = next
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
  } catch {
    // 持久化失败不影响当前会话
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = next
  }
  return next
}

export type { MessageSchema }
