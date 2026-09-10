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
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { personalApi } from '@/api/portal'
import { authState, clearSession } from '@/auth/session'
import { setLocale } from '@/i18n'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const identityStore = useIdentityStore()

const collapsed = ref(false)
const searchKeyword = ref('')
const unread = ref(0)
const commandOpen = ref(false)
const commandQuery = ref('')
const commandInput = ref<{ focus?: () => void } | null>(null)

interface PortalCommand {
  id: string
  label: string
  description: string
  path: string
  assistantQuery?: string
}

const commonCommands: PortalCommand[] = [
  { id: 'assistant', label: '打开智能服务', description: '对话、检索与任务协助', path: '/assistant' },
  { id: 'todos', label: '查看我的待办', description: '进入个人工作台的审批与任务', path: '/personal' },
  { id: 'data', label: '查找数据服务', description: '浏览可申请的数据服务与数据集', path: '/data-workbench' },
  { id: 'algorithm', label: '运行算法服务', description: '选择算法并进入在线运行向导', path: '/algorithm-workbench' },
]

const intentCommands: PortalCommand[] = [
  { id: 'intent-data', label: '帮我找数据服务', description: '将意图交给智能服务处理', path: '/assistant', assistantQuery: '帮我找数据服务' },
  { id: 'intent-run', label: '帮我跑目标特性提取', description: '从智能服务开始配置运行', path: '/assistant', assistantQuery: '跑一遍港区目标特性提取' },
  { id: 'intent-approval', label: '我有哪些待办审批', description: '查询当前需要处理的审批', path: '/assistant', assistantQuery: '我有哪些待办审批' },
]

const recentCommands = ref<PortalCommand[]>([])

const commandResults = computed(() => {
  const keyword = commandQuery.value.trim().toLowerCase()
  const candidates = [...commonCommands, ...recentCommands.value]
  if (!keyword) return candidates
  return candidates.filter((item) => `${item.label}${item.description}`.toLowerCase().includes(keyword))
})

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
  { value: 'en-US', label: '英文' },
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

function openCommandPalette() {
  commandQuery.value = searchKeyword.value
  commandOpen.value = true
  void nextTick(() => commandInput.value?.focus?.())
}

function runCommand(command: PortalCommand, queryOverride?: string) {
  const assistantQuery = queryOverride?.trim() || command.assistantQuery
  const recent = [command, ...recentCommands.value.filter((item) => item.id !== command.id)].slice(0, 3)
  recentCommands.value = recent
  localStorage.setItem('od:recent-commands', JSON.stringify(recent))
  commandOpen.value = false
  void router.push({ path: command.path, query: assistantQuery ? { q: assistantQuery } : {} })
}

function submitCommandSearch() {
  const query = commandQuery.value.trim()
  if (!query) return
  runCommand({ id: 'search', label: `智能服务：${query}`, description: '在智能服务中继续处理', path: '/assistant' }, query)
}

function handleCommandKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    openCommandPalette()
  }
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
  try {
    const cached = JSON.parse(localStorage.getItem('od:recent-commands') ?? '[]')
    if (Array.isArray(cached)) recentCommands.value = cached.filter((item): item is PortalCommand => typeof item?.id === 'string' && typeof item.path === 'string').slice(0, 3)
  } catch {
    localStorage.removeItem('od:recent-commands')
  }
  window.addEventListener('keydown', handleCommandKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', handleCommandKeydown))
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
          <button
            type="button"
            class="collapse-trigger"
            :aria-label="collapsed ? '展开导航' : '折叠导航'"
            :title="collapsed ? '展开导航' : '折叠导航'"
            @click="collapsed = !collapsed"
          >
            <component :is="collapsed ? MenuUnfoldOutlined : MenuFoldOutlined" />
          </button>
          <span class="title">{{ pageTitle }}</span>
        </div>

        <div class="header-right">
          <!-- 快捷智能搜索栏：点击/CTRL+K 就地展开命令面板（不再聚焦跳转） -->
          <div class="search-wrap">
            <a-input
              v-model:value="searchKeyword"
              class="global-search"
              :placeholder="t('layout.searchPlaceholder')"
              readonly
              @click="openCommandPalette"
            >
              <template #prefix>
                <SearchOutlined style="color: #94a3b8" />
              </template>
              <template #suffix>
                <span class="kbd-badge">快捷键</span>
              </template>
            </a-input>
          </div>

          <!-- 待办/通知铃铛 -->
          <div class="bell">
            <a-badge :count="unread" :offset="[-4, 4]" class="bell-badge">
              <button type="button" class="icon-action-btn" aria-label="通知中心" @click="goNotifications">
                <BellOutlined />
              </button>
            </a-badge>
          </div>

          <!-- 当前登录角色由身份服务返回，并与路由访问控制保持一致。 -->
          <div v-if="identityStore.roles.length > 0" class="header-role-tags" aria-label="当前角色">
            <a-tag v-for="role in identityStore.roles" :key="role" color="blue" class="header-role-tag">
              {{ 中文展示(role) }}
            </a-tag>
          </div>

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
                    {{ identityStore.identity.roles.map(中文展示).join('、') || '未分配角色' }}
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

      <a-modal
        v-model:open="commandOpen"
        :footer="null"
        :width="640"
        class="command-palette"
        :title="null"
      >
        <div class="command-palette__header">
          <span class="command-palette__eyebrow">快速命令</span>
          <span class="command-palette__hint">按退出键关闭</span>
        </div>
        <a-input
          ref="commandInput"
          v-model:value="commandQuery"
          class="command-palette__input"
          placeholder="搜索页面，或直接输入问题交给智能服务"
          size="large"
          @press-enter="submitCommandSearch"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>

        <button
          v-if="commandQuery.trim()"
          type="button"
          class="command-item command-item--query"
          @click="submitCommandSearch"
        >
          <span>
            <strong>交给智能服务</strong>
            <small>“{{ commandQuery.trim() }}”</small>
          </span>
          <span class="command-item__shortcut">回车</span>
        </button>

        <div class="command-palette__section">
          <span>快速进入</span>
        </div>
        <div class="command-list">
          <button
            v-for="command in commandResults"
            :key="command.id"
            type="button"
            class="command-item"
            @click="runCommand(command)"
          >
            <span>
              <strong>{{ command.label }}</strong>
              <small>{{ command.description }}</small>
            </span>
            <span class="command-item__arrow">↵</span>
          </button>
          <p v-if="commandResults.length === 0" class="command-empty">没有匹配页面，按回车将问题发送给智能服务。</p>
        </div>

        <div class="command-palette__section"><span>常用意图</span></div>
        <div class="intent-list">
          <button v-for="command in intentCommands" :key="command.id" type="button" @click="runCommand(command)">{{ command.label }}</button>
        </div>
      </a-modal>
    </a-layout>
  </a-layout>
</template>

<style scoped>
.portal-root-layout {
  height: 100vh;
  overflow: hidden;
  background: var(--od-gray-50, #f8fafc);
}

.portal-sider {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
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
  height: 100vh;
  overflow: hidden;
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
  padding: 0;
  border: 0;
  background: transparent;
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

.header-role-tags {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-role-tag {
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
  height: calc(100vh - var(--od-topbar-height, 60px));
  overflow-y: auto;
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

:deep(.command-palette .ant-modal-content) {
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--od-shadow-3);
}

.command-palette__header,
.command-palette__section,
.command-item,
.intent-list {
  display: flex;
  align-items: center;
}

.command-palette__header {
  justify-content: space-between;
  margin-bottom: 12px;
}

.command-palette__eyebrow {
  color: var(--od-color-primary, #1e40af);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.command-palette__hint,
.command-item small,
.command-empty {
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
}

.command-palette__input {
  border-radius: 10px;
}

.command-palette__section {
  margin: 18px 0 8px;
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
  font-weight: 650;
}

.command-list {
  display: grid;
  gap: 4px;
}

.command-item {
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 10px 12px;
  background: transparent;
  color: var(--od-gray-800, #1e293b);
  cursor: pointer;
  text-align: left;
}

.command-item:hover,
.command-item:focus-visible {
  border-color: var(--od-primary-200, #bfdbfe);
  background: var(--od-primary-50, #eff6ff);
  outline: none;
}

.command-item > span:first-child {
  display: grid;
  gap: 2px;
}

.command-item--query {
  margin-top: 10px;
  border-color: var(--od-primary-200, #bfdbfe);
  background: var(--od-primary-50, #eff6ff);
}

.command-item__shortcut,
.command-item__arrow {
  color: var(--od-gray-400, #94a3b8);
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
}

.command-empty {
  margin: 8px 12px;
}

.intent-list {
  flex-wrap: wrap;
  gap: 8px;
}

.intent-list button {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 999px;
  padding: 6px 10px;
  background: #fff;
  color: var(--od-gray-700, #334155);
  cursor: pointer;
}

.intent-list button:hover {
  border-color: var(--od-primary-300, #93c5fd);
  color: var(--od-color-primary, #1e40af);
}
</style>
