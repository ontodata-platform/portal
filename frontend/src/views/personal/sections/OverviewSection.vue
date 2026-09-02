<script setup lang="ts">
import {
  AppstoreOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
} from '@ant-design/icons-vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { personalApi, resultApi } from '@/api/portal'
import { useIdentityStore } from '@/stores/identity'
import type { PortalNotification, PortalResult } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'

const { t } = useI18n()
const router = useRouter()
const identityStore = useIdentityStore()

const results = ref<PortalResult[]>([])
const notifications = ref<PortalNotification[]>([])

const shortcuts = [
  { key: '/assistant', labelKey: 'personal.overview.shortcutAssistant', icon: RobotOutlined, admin: false },
  { key: '/marketplace', labelKey: 'personal.overview.shortcutMarketplace', icon: ShopOutlined, admin: false },
  { key: '/workbench', labelKey: 'personal.overview.shortcutWorkbench', icon: AppstoreOutlined, admin: false },
  { key: '/admin/operations', labelKey: 'personal.overview.shortcutAdmin', icon: SafetyCertificateOutlined, admin: true },
]

async function load() {
  const [resultPage, noticePage] = await Promise.all([
    resultApi.list({ page: 1, size: 3 }),
    personalApi.notifications({ page: 1, size: 3 }),
  ])
  results.value = resultPage.items
  notifications.value = noticePage.items
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="overview">
    <a-row :gutter="16" class="shortcuts">
      <a-col
        v-for="item in shortcuts.filter((s) => !s.admin || identityStore.canAccessOperations)"
        :key="item.key"
        :xs="24"
        :sm="12"
        :md="6"
      >
        <a-card hoverable class="shortcut" @click="router.push(item.key)">
          <component :is="item.icon" class="shortcut-icon" />
          <div>{{ t(item.labelKey) }}</div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('personal.overview.recentResults')" size="small">
          <EmptyState
            v-if="results.length === 0"
            :title="t('personal.overview.emptyResults')"
            :action-label="t('personal.overview.tabResults')"
            @action="router.push('/personal/results')"
          />
          <a-list v-else :data-source="results">
            <template #renderItem="{ item }">
              <a-list-item>{{ item.resultId }} · {{ item.sourceSystem }}</a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('personal.overview.recentNotifications')" size="small">
          <EmptyState
            v-if="notifications.length === 0"
            :title="t('personal.overview.emptyNotifications')"
            :action-label="t('personal.overview.tabNotifications')"
            @action="router.push('/personal/notifications')"
          />
          <a-list v-else :data-source="notifications">
            <template #renderItem="{ item }">
              <a-list-item>{{ item.title }}</a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shortcut {
  text-align: center;
  cursor: pointer;
}

.shortcut-icon {
  font-size: 22px;
  color: #1f4e79;
  margin-bottom: 8px;
}
</style>
