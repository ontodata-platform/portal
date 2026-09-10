import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useFavoritesStore } from '@/stores/favorites'

describe('useFavoritesStore（B5 收藏与历史）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('收藏切换与持久化', () => {
    const store = useFavoritesStore()
    expect(store.isFavorite('ds-gaofen-optical')).toBe(false)

    expect(store.toggleFavorite('ds-gaofen-optical', '高分光学卫星影像')).toBe(true)
    expect(store.isFavorite('ds-gaofen-optical')).toBe(true)
    expect(store.favorites[0].name).toBe('高分光学卫星影像')

    expect(store.toggleFavorite('ds-gaofen-optical', '高分光学卫星影像')).toBe(false)
    expect(store.favorites).toEqual([])
  })

  it('浏览历史去重置顶且上限 50 条', () => {
    const store = useFavoritesStore()
    for (let index = 0; index < 60; index += 1) {
      store.recordVisit(`ds-${index}`, `产品${index}`)
    }
    expect(store.history).toHaveLength(50)

    store.recordVisit('ds-59', '产品59')
    expect(store.history[0].code).toBe('ds-59')
    expect(store.history.filter((item) => item.code === 'ds-59')).toHaveLength(1)
  })

  it('clearHistory 清空历史但不影响收藏', () => {
    const store = useFavoritesStore()
    store.toggleFavorite('ds-sst-field', '海表温度场')
    store.recordVisit('ds-sst-field', '海表温度场')

    store.clearHistory()

    expect(store.history).toEqual([])
    expect(store.favorites).toHaveLength(1)
  })
})
