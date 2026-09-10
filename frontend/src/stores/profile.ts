import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 个人资料与通知偏好（C6-1）：localStorage 持久。
 * 真实模式契约（对齐后端 T1-1）：
 *   GET/PATCH /api/v1/personal/profile
 */
export interface PersonalProfile {
  contact: string
  location: string
  prefs: {
    popupOnArrival: boolean
    approvalReminders: boolean
    taskReminders: boolean
  }
}

const PROFILE_KEY = 'od-profile'

const DEFAULT_PROFILE: PersonalProfile = {
  contact: '',
  location: '',
  prefs: { popupOnArrival: true, approvalReminders: true, taskReminders: true },
}

function load(): PersonalProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE, prefs: { ...DEFAULT_PROFILE.prefs } }
    const parsed = JSON.parse(raw) as Partial<PersonalProfile>
    return { ...DEFAULT_PROFILE, ...parsed, prefs: { ...DEFAULT_PROFILE.prefs, ...(parsed.prefs ?? {}) } }
  } catch {
    return { ...DEFAULT_PROFILE, prefs: { ...DEFAULT_PROFILE.prefs } }
  }
}

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<PersonalProfile>(load())

  function update(patch: Partial<PersonalProfile>): void {
    profile.value = { ...profile.value, ...patch, prefs: { ...profile.value.prefs, ...(patch.prefs ?? {}) } }
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile.value))
    } catch {
      /* 存储不可用时仅内存态 */
    }
  }

  return { profile, update }
})
