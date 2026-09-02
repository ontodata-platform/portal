<script setup lang="ts">
import {
  AppstoreOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  DatabaseOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { personalApi } from '@/api/portal'
import { authState, clearSession } from '@/auth/session'
import { setLocale } from '@/i18n'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const identityStore = useIdentityStore()

const collapsed = ref(false)
const searchKeyword = ref('')
const unread = ref(0)

const navItems = computed(() => {
  const items = [
    { key: '/assistant', label: t('menu.assistant'), icon: RobotOutlined },
    { key: '/personal', label: t('menu.personal'), icon: UserOutlined },
    { key: '/data-workbench', label: t('menu.marketplace'), icon: DatabaseOutlined },
    { key: '/algorithm-workbench', label: t('menu.algorithmWorkbench'), icon: AppstoreOutlined },
  ]
  if (identityStore.canAccessOperations) {
    items.push({ key: '/admin/operations', label: t('menu.admin'), icon: SafetyCertificateOutlined })
  }
  return items
})

const selectedKeys = computed(() => {
  const path = route.path
  if (path.startsWith('/personal')) return ['/personal']
  if (path.startsWith('/data-workbench') || path.startsWith('/marketplace')) return ['/data-workbench']
  if (path.startsWith('/algorithm-workbench') || path.startsWith('/workbench')) return ['/algorithm-workbench']
  if (path.startsWith('/admin')) return ['/admin/operations']
  if (path.startsWith('/assistant')) return ['/assistant']
  return [path]
})

const pageTitle = computed(() =>
  route.meta.titleKey ? t(route.meta.titleKey as string) : t('layout.appName'),
)

const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  void router.push(key as string)
}

const handleLocaleChange = (value: unknown) => {
  setLocale(String(value ?? 'zh-CN'))
}

const handleLogout = () => {
  clearSession()
  identityStore.reset()
  void router.push('/login')
}

function goSearch() {
  void router.push({
    path: '/assistant',
    query: searchKeyword.value.trim() ? { q: searchKeyword.value.trim() } : {},
  })
}

function goNotifications() {
  void router.push('/personal/notifications')
}

async function loadUnread() {
  try {
    unread.value = (await personalApi.unreadCount()).unread
  } catch {
    unread.value = 0
  }
}

onMounted(() => {
  void identityStore.fetchIdentity()
  void loadUnread()
})
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider
      v-model:collapsed="collapsed"
      collapsible
      theme="dark"
      width="220"
      class="portal-sider"
    >
      <div class="logo">
        <span class="logo-text">{{ t('layout.appName') }}</span>
      </div>
      <a-menu theme="dark" mode="inline" :selected-keys="selectedKeys" @click="handleMenuClick">
        <a-menu-item v-for="item in navItems.slice(0, 4)" :key="item.key">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </a-menu-item>
      </a-menu>
      <div v-if="identityStore.canAccessOperations" class="sider-admin">
        <a-menu theme="dark" mode="inline" :selected-keys="selectedKeys" @click="handleMenuClick">
          <a-menu-item key="/admin/operations">
            <SafetyCertificateOutlined />
            <span>{{ t('menu.admin') }}</span>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="header">
        <div class="header-left">
          <component
            :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined"
            class="collapse-trigger"
            @click="collapsed = !collapsed"
          />
          <span class="title">{{ pageTitle }}</span>
        </div>

        <div class="header-right">
          <a-input
            v-model:value="searchKeyword"
            class="global-search"
            :placeholder="t('layout.searchPlaceholder')"
            allow-clear
            @focus="goSearch"
            @press-enter="goSearch"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>

          <a-badge :count="unread" class="bell">
            <a-button type="text" @click="goNotifications">
              <BellOutlined />
            </a-button>
          </a-badge>

          <a-dropdown>
            <span class="avatar-trigger">
              <a-avatar size="small">{{ identityStore.name.slice(0, 1) }}</a-avatar>
              <span class="user-name">{{ identityStore.name }}</span>
            </span>
            <template #overlay>
              <a-menu>
                <a-menu-item disabled>{{ identityStore.name }} · {{ identityStore.tenantId }}</a-menu-item>
                <a-menu-item>
                  <span class="locale-row">
                    {{ t('layout.locale') }}
                    <a-select
                      :value="$i18n.locale"
                      :options="localeOptions"
                      class="locale-select"
                      @change="handleLocaleChange"
                    />
                  </span>
                </a-menu-item>
                <a-menu-item v-if="authState.session" @click="handleLogout">{{ t('layout.logout') }}</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content class="content">
        <a-alert
          v-if="messageStore.feedback"
          :type="messageStore.feedback.kind"
          :message="messageStore.feedback.content"
          :description="
            messageStore.feedback.traceId && !String(messageStore.feedback.traceId).startsWith('mock')
              ? t('layout.feedbackTrace', { traceId: messageStore.feedback.traceId })
              : undefined
          "
          show-icon
          closable
          class="feedback"
          @close="messageStore.clear"
        />
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.portal-sider {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, 0.05);
  display: flex;
  flex-direction: column;
}

.logo {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  padding: 16px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sider-admin {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-trigger {
  font-size: 16px;
  cursor: pointer;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--od-gray-800, #1e293b);
}

.global-search {
  width: 240px;
}

.bell :deep(.ant-btn) {
  padding: 0 8px;
}

.avatar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.user-name {
  font-weight: 500;
}

.locale-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.locale-select {
  width: 100px;
}

.content {
  padding: 20px 24px;
  background: #f4f7fb;
  min-height: calc(100vh - 60px);
}

.feedback {
  margin-bottom: 16px;
}
</style>
