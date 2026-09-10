<script setup lang="ts">
/**
 * 资料与权限（C6）：个人资料维护 + 通知偏好 + 权限全景。
 * 门户角色来自身份（devMode 下为演示角色）；我的订阅来自数据工作台；
 * 外部系统权限为分系统返回的非权威副本展示（真实契约见后端 T1-1）。
 */
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIdentityStore } from '@/stores/identity'
import { useProfileStore } from '@/stores/profile'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const identityStore = useIdentityStore()
const profileStore = useProfileStore()

const profileForm = reactive({
  contact: profileStore.profile.contact,
  location: profileStore.profile.location,
})

const prefs = computed(() => profileStore.profile.prefs)

const demoSubscriptions = [
  { name: '高分光学卫星影像-东海重点海域', scope: '东海 · 12 景/月', expires: '2026-12-31' },
  { name: '海表温度场', scope: '东海 · 日更推送', expires: '2026-10-31' },
]

const demoExternalPermissions = [
  { system: '管理平台', role: '数据使用人', resource: '目录检索/订阅', expires: '2026-12-31', source: 'data-platform', syncedAt: '2026-09-11 08:00' },
  { system: '算法重组平台', role: '算法用户', resource: '已发布算法运行', expires: '2026-11-30', source: 'recombine', syncedAt: '2026-09-11 08:00' },
]

function saveProfile(): void {
  profileStore.update({ contact: profileForm.contact, location: profileForm.location })
}

function setPref(key: keyof typeof prefs.value, checked: boolean): void {
  profileStore.update({ prefs: { ...prefs.value, [key]: checked } })
}
</script>

<template>
  <div class="profile-section">
    <a-card :bordered="false" class="profile-card">
      <h3 class="profile-title">{{ t('personal.profileTab.profileTitle') }}</h3>
      <a-form layout="vertical" class="profile-form">
        <a-form-item :label="t('personal.profileTab.name')">
          <a-input :value="identityStore.name" disabled />
        </a-form-item>
        <a-form-item :label="t('personal.profileTab.contact')">
          <a-input v-model:value="profileForm.contact" :placeholder="t('personal.profileTab.contactPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('personal.profileTab.location')">
          <a-input v-model:value="profileForm.location" :placeholder="t('personal.profileTab.locationPlaceholder')" />
        </a-form-item>
        <a-button type="primary" @click="saveProfile">{{ t('personal.profileTab.save') }}</a-button>
      </a-form>

      <h3 class="profile-title">{{ t('personal.profileTab.prefsTitle') }}</h3>
      <div class="pref-row">
        <span>{{ t('personal.profileTab.prefPopup') }}</span>
        <a-switch :checked="prefs.popupOnArrival" @change="(checked: boolean) => setPref('popupOnArrival', checked)" />
      </div>
      <div class="pref-row">
        <span>{{ t('personal.profileTab.prefApproval') }}</span>
        <a-switch :checked="prefs.approvalReminders" @change="(checked: boolean) => setPref('approvalReminders', checked)" />
      </div>
      <div class="pref-row">
        <span>{{ t('personal.profileTab.prefTask') }}</span>
        <a-switch :checked="prefs.taskReminders" @change="(checked: boolean) => setPref('taskReminders', checked)" />
      </div>
    </a-card>

    <a-card :bordered="false" class="profile-card">
      <h3 class="profile-title">{{ t('personal.profileTab.portalPermission') }}</h3>
      <p class="profile-line">
        {{ t('personal.profileTab.currentRoles') }}：
        <a-tag v-for="role in identityStore.roles" :key="role" color="blue">{{ 中文展示(role) }}</a-tag>
      </p>

      <h3 class="profile-title">{{ t('personal.profileTab.dataGrants') }}</h3>
      <p v-for="sub in demoSubscriptions" :key="sub.name" class="profile-line">
        {{ sub.name }} · {{ sub.scope }} · {{ t('personal.profileTab.expires') }} {{ sub.expires }}
      </p>

      <h3 class="profile-title">{{ t('personal.profileTab.externalCopy') }}</h3>
      <p class="profile-copy-hint">{{ t('personal.profileTab.externalCopyHint') }}</p>
      <div v-for="item in demoExternalPermissions" :key="`${item.system}-${item.role}`" class="external-row">
        <a-tag color="default">{{ item.system }}</a-tag>
        <span class="external-role">{{ item.role }}</span>
        <span class="external-resource">{{ item.resource }}</span>
        <span class="external-meta">{{ t('personal.profileTab.expires') }} {{ item.expires }} · {{ t('personal.profileTab.syncedAt') }} {{ item.syncedAt }}</span>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.profile-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}

.profile-card {
  border-radius: 12px;
}

.profile-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.profile-form {
  max-width: 420px;
  margin-bottom: 20px;
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 420px;
  padding: 6px 0;
  font-size: 13px;
}

.profile-line {
  font-size: 13px;
  margin: 4px 0;
}

.profile-copy-hint {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
  margin: 0 0 8px;
}

.external-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
}

.external-role {
  font-weight: 500;
}

.external-resource {
  color: var(--od-gray-500, #64748b);
}

.external-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}
</style>
