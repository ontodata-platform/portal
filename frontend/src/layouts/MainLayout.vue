<script setup lang="ts">
import {
  AppstoreOutlined,
  BellOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
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
  { value: 'zh-CN', label: '简体中文' },
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
  <a-layout class="portal-root-layout">
    <!-- 现代化深色侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      collapsible
      theme="dark"
      width="230"
      class="portal-sider"
    >
      <div class="logo">
        <div class="logo-badge">OD</div>
        <span v-if="!collapsed" class="logo-text">{{ t('layout.appName') }}</span>
      </div>

      <div v-if="!collapsed" class="nav-section-title">工作台导航</div>
      <a-menu
        theme="dark"
        mode="inline"
        :selected-keys="selectedKeys"
        class="portal-nav-menu"
        @click="handleMenuClick"
      >
        <a-menu-item v-for="item in navItems.slice(0, 4)" :key="item.key">
          <template #icon>
            <component :is="item.icon" />
          </template>
          <span>{{ item.label }}</span>
        </a-menu-item>
      </a-menu>

      <div v-if="identityStore.canAccessOperations" class="sider-admin">
        <div v-if="!collapsed" class="nav-section-title">管理中心</div>
        <a-menu
          theme="dark"
          mode="inline"
          :selected-keys="selectedKeys"
          class="portal-nav-menu"
          @click="handleMenuClick"
        >
          <a-menu-item key="/admin/operations">
            <template #icon>
              <SafetyCertificateOutlined />
            </template>
            <span>{{ t('menu.admin') }}</span>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>

    <a-layout class="portal-main-area">
      <!-- 磨砂质感顶栏 -->
      <a-layout-header class="header">
        <div class="header-left">
          <div
            class="collapse-trigger"
            :title="collapsed ? '展开导航' : '折叠导航'"
            @click="collapsed = !collapsed"
          >
            <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
          </div>
          <span class="title">{{ pageTitle }}</span>
        </div>

        <div class="header-right">
          <!-- 快捷智能搜索栏 -->
          <div class="search-wrap">
            <a-input
              v-model:value="searchKeyword"
              class="global-search"
              :placeholder="t('layout.searchPlaceholder')"
              allow-clear
              @focus="goSearch"
              @press-enter="goSearch"
            >
              <template #prefix>
                <SearchOutlined style="color: #94a3b8" />
              </template>
              <template #suffix>
                <span class="kbd-badge">Ctrl K</span>
              </template>
            </a-input>
          </div>

          <!-- 待办/通知铃铛 -->
          <div class="bell">
            <a-badge :count="unread" :offset="[-4, 4]" class="bell-badge">
              <button type="button" class="icon-action-btn" aria-label="Notifications" @click="goNotifications">
                <BellOutlined />
              </button>
            </a-badge>
          </div>

          <!-- 租户标签 -->
          <a-tag color="blue" class="tenant-tag">{{ identityStore.tenantId }}</a-tag>

          <!-- 个人头像与操作下拉 -->
          <a-dropdown placement="bottomRight" :trigger="['click']">
            <div class="avatar-trigger" role="button" tabindex="0">
              <a-avatar size="small" class="user-avatar">
                {{ identityStore.name.slice(0, 1).toUpperCase() }}
              </a-avatar>
              <span class="user-name">{{ identityStore.name }}</span>
            </div>
            <template #overlay>
              <a-menu class="user-dropdown-menu">
                <div class="user-dropdown-header">
                  <div class="user-dropdown-name">{{ identityStore.name }}</div>
                  <div class="user-dropdown-meta">
                    {{ identityStore.tenantId }}
                    <template v-if="identityStore.identity.roles.length > 0">
                      · {{ identityStore.identity.roles.join(', ') }}
                    </template>
                  </div>
                </div>
                <a-menu-item key="locale">
                  <div class="locale-row">
                    <GlobalOutlined />
                    <span>{{ t('layout.locale') }}</span>
                    <a-select
                      :value="$i18n.locale"
                      :options="localeOptions"
                      size="small"
                      class="locale-select"
                      @change="handleLocaleChange"
                    />
                  </div>
                </a-menu-item>
                <a-menu-item v-if="authState.session" key="logout" danger @click="handleLogout">
                  <LogoutOutlined />
                  <span>{{ t('layout.logout') }}</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 页面主体容器 -->
      <a-layout-content class="content">
        <transition name="feedback-fade">
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
            class="feedback-banner"
            @close="messageStore.clear"
          />
        </transition>
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.portal-root-layout {
  min-height: 100vh;
  background: var(--od-gray-50, #f8fafc);
}

.portal-sider {
  box-shadow: 2px 0 8px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  background: #0f172a !important;
  z-index: 10;
}

.logo {
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-badge {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
}

.logo-text {
  letter-spacing: -0.01em;
}

.nav-section-title {
  padding: 16px 16px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.portal-nav-menu {
  background: transparent !important;
  border-inline-end: 0 !important;
  padding: 0 8px;
}

:deep(.portal-nav-menu .ant-menu-item) {
  border-radius: 8px !important;
  margin: 4px 0 !important;
  height: 40px !important;
  line-height: 40px !important;
  color: #94a3b8;
  font-weight: 500;
  transition: all 0.15s ease;
}

:deep(.portal-nav-menu .ant-menu-item:hover) {
  color: #f8fafc !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

:deep(.portal-nav-menu .ant-menu-item-selected) {
  color: #ffffff !important;
  background: #2563eb !important;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.sider-admin {
  margin-top: auto;
  padding-bottom: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.portal-main-area {
  background: var(--od-gray-50, #f8fafc);
}

.header {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--od-gray-200, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: var(--od-topbar-height, 60px);
  position: sticky;
  top: 0;
  z-index: 9;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-trigger {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 16px;
  color: var(--od-gray-600, #475569);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.collapse-trigger:hover {
  background: var(--od-gray-100, #f1f5f9);
  color: var(--od-color-primary, #1e40af);
}

.title {
  font-size: 16px;
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
  letter-spacing: -0.01em;
}

.search-wrap {
  width: 260px;
}

.global-search {
  border-radius: 20px;
  background: var(--od-gray-50, #f8fafc);
  border-color: var(--od-gray-200, #e2e8f0);
}

.global-search:focus-within {
  background: #fff;
  box-shadow: var(--od-focus-ring);
}

.kbd-badge {
  font-size: 11px;
  font-family: var(--od-font-mono, monospace);
  padding: 1px 5px;
  background: var(--od-gray-200, #e2e8f0);
  color: var(--od-gray-600, #475569);
  border-radius: 4px;
}

.bell {
  display: inline-flex;
  align-items: center;
}

.icon-action-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--od-gray-600, #475569);
  cursor: pointer;
  font-size: 15px;
  transition: all 0.15s;
}

.icon-action-btn:hover {
  border-color: var(--od-primary-300, #93c5fd);
  color: var(--od-color-accent, #2563eb);
}

.tenant-tag {
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 8px;
}

.avatar-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 4px;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.avatar-trigger:hover {
  background: var(--od-gray-100, #f1f5f9);
}

.user-avatar {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  font-weight: 700;
}

.user-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--od-gray-800, #1e293b);
}

.user-dropdown-menu {
  min-width: 220px;
  border-radius: 12px;
  box-shadow: var(--od-shadow-3);
  padding: 8px;
}

.user-dropdown-header {
  padding: 8px 12px 6px;
}

.user-dropdown-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--od-gray-900, #0f172a);
}

.user-dropdown-meta {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
  margin-top: 2px;
}

.locale-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.locale-select {
  width: 100px;
  margin-left: auto;
}

.content {
  padding: 24px;
  background: var(--od-gray-50, #f8fafc);
  min-height: calc(100vh - 60px);
}

.feedback-banner {
  margin-bottom: 20px;
  border-radius: 10px;
  box-shadow: var(--od-shadow-xs);
}

.feedback-fade-enter-active,
.feedback-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.feedback-fade-enter-from,
.feedback-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
