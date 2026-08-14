import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, i18n, setLocale } from './index'
import { enUs, zhCn } from './messages'

/** 递归收集消息目录键路径（用于中英文目录结构一致性断言）。 */
function keysOf(node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') {
      return keysOf(value as Record<string, unknown>, path)
    }
    return [path]
  })
}

describe('国际化（M5）', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setLocale(DEFAULT_LOCALE)
  })

  it('zh-CN 与 en-US 键结构完全一致（半英文化在编译期被 MessageSchema 拦截，此处再运行时兜底）', () => {
    expect(keysOf(enUs).sort()).toEqual(keysOf(zhCn).sort())
  })

  it('缺省语言 zh-CN，切换语言即时生效', () => {
    expect(i18n.global.locale.value).toBe(DEFAULT_LOCALE)
    expect(i18n.global.t('menu.tasks')).toBe('统一任务中心')

    expect(setLocale('en-US')).toBe('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
    expect(i18n.global.t('menu.tasks')).toBe('Unified Task Center')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US')
  })

  it('非法语言取值回退 zh-CN', () => {
    setLocale('en-US')
    expect(setLocale('fr-FR')).toBe(DEFAULT_LOCALE)
    expect(i18n.global.locale.value).toBe(DEFAULT_LOCALE)
  })

  it('插值消息按语言解析（含参数）', () => {
    setLocale('zh-CN')
    expect(i18n.global.t('operations.noticePublished', { code: 'ntc-1' })).toBe('公告 ntc-1 已发布')
    setLocale('en-US')
    expect(i18n.global.t('operations.noticePublished', { code: 'ntc-1' })).toBe('Notice ntc-1 published')
  })
})
