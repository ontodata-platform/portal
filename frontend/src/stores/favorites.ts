import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 收藏与浏览历史（B5）：localStorage 持久（真实模式契约见下），
 * 仅覆盖数据服务目录对象；算法收藏后续复用同一结构（kind 区分）。
 *
 * 真实模式契约（对齐后端 T2-1）：
 *   GET/PUT/DELETE /api/v1/favorites
 *   GET /api/v1/browse-history
 */

export interface FavoriteRef {
  code: string
  name: string
  addedAt: string
}

export interface HistoryRef {
  code: string
  name: string
  visitedAt: string
}

const FAVORITES_KEY = 'od-favorites'
const HISTORY_KEY = 'od-browse-history'
const HISTORY_LIMIT = 50

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function save<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    /* 存储不可用时静默降级：仅内存态 */
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<FavoriteRef[]>(load(FAVORITES_KEY))
  const history = ref<HistoryRef[]>(load(HISTORY_KEY))

  function isFavorite(code: string): boolean {
    return favorites.value.some((item) => item.code === code)
  }

  /** 收藏/取消收藏；返回切换后的状态。 */
  function toggleFavorite(code: string, name: string): boolean {
    if (isFavorite(code)) {
      favorites.value = favorites.value.filter((item) => item.code !== code)
      save(FAVORITES_KEY, favorites.value)
      return false
    }
    favorites.value = [...favorites.value, { code, name, addedAt: new Date().toISOString() }]
    save(FAVORITES_KEY, favorites.value)
    return true
  }

  function removeFavorite(code: string): void {
    favorites.value = favorites.value.filter((item) => item.code !== code)
    save(FAVORITES_KEY, favorites.value)
  }

  /** 记录详情访问：按 code 去重置顶，最多保留 HISTORY_LIMIT 条。 */
  function recordVisit(code: string, name: string): void {
    history.value = [
      { code, name, visitedAt: new Date().toISOString() },
      ...history.value.filter((item) => item.code !== code),
    ].slice(0, HISTORY_LIMIT)
    save(HISTORY_KEY, history.value)
  }

  function clearHistory(): void {
    history.value = []
    save(HISTORY_KEY, history.value)
  }

  return { favorites, history, isFavorite, toggleFavorite, removeFavorite, recordVisit, clearHistory }
})
