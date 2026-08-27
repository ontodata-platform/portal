<script setup lang="ts">
import {
  AppstoreOutlined,
  AuditOutlined,
  CarryOutOutlined,
  DeploymentUnitOutlined,
  FileDoneOutlined,
  HomeOutlined,
  RobotOutlined,
  ShopOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { authState, clearSession } from '@/auth/session'
import { setLocale } from '@/i18n'
import { useMessageStore } from '@/stores/message'
import { useTenantStore } from '@/stores/tenant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const tenantStore = useTenantStore()

/** 菜单与页面标题按界面语言解析（M5 国际化）。 */
const menus = computed(() => [
  { key: '/operations', label: t('menu.operations'), icon: HomeOutlined },
  { key: '/marketplace', label: t('menu.marketplace'), icon: ShopOutlined },
  { key: '/workbench', label: t('menu.workbench'), icon: AppstoreOutlined },
  { key: '/tasks', label: t('menu.tasks'), icon: CarryOutOutlined },
  { key: '/approvals', label: t('menu.approvals'), icon: AuditOutlined },
  { key: '/results', label: t('menu.results'), icon: FileDoneOutlined },
  { key: '/requirements', label: t('menu.requirements'), icon: SolutionOutlined },
  { key: '/scenarios', label: t('menu.scenarios'), icon: DeploymentUnitOutlined },
  { key: '/personal', label: t('menu.personal'), icon: UserOutlined },
  { key: '/agent/chat', label: t('menu.agentChat'), icon: RobotOutlined },
])

const selectedKey = computed(() => route.path)
const pageTitle = computed(() =>
  route.meta.titleKey ? t(route.meta.titleKey as string) : t('layout.appName'),
)

/** M5 多租户验收租户清单；combobox 允许输入自定义租户标识（非法时退回 default）。 */
const tenantOptions = computed(() => [
  { value: 'default', label: t('layout.defaultTenant') },
  { value: 'tenant-a', label: t('layout.tenantA') },
  { value: 'tenant-b', label: t('layout.tenantB') },
])

/** 语言清单：切换即时生效并持久化（M5 国际化）。 */
const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  router.push(key as string)
}

const handleTenantChange = (value: unknown) => {
  const typed = String(value ?? '')
  const effective = tenantStore.switchTenant(typed)
  if (typed.trim() !== effective) {
    messageStore.reportError(new ApiError(400, 'INVALID_TENANT', t('layout.invalidTenant')))
  }
}

const handleLocaleChange = (value: unknown) => {
  setLocale(String(value ?? 'zh-CN'))
}

/** 退出登录（M5 IAM）：清除会话后回登录页（未启用 IAM 时按钮不显示）。 */
const handleLogout = () => {
  clearSession()
  router.push('/login')
}
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider theme="dark">
      <div class="logo">{{ t('layout.appName') }}</div>
      <a-menu
        theme="dark"
        mode="inline"
        :selected-keys="[selectedKey]"
        @click="handleMenuClick"
      >
        <a-menu-item v-for="menu in menus" :key="menu.key">
          <component :is="menu.icon" />
          <span>{{ menu.label }}</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <span class="title">{{ pageTitle }}</span>
        <div class="header-spacer"></div>
        <span class="header-label">{{ t('layout.locale') }}</span>
        <a-select
          :value="$i18n.locale"
          :options="localeOptions"
          class="locale-select"
          @change="handleLocaleChange"
        />
        <span class="header-label">{{ t('layout.tenant') }}</span>
        <a-select
          :value="tenantStore.tenantId"
          mode="combobox"
          :options="tenantOptions"
          class="tenant-select"
          @change="handleTenantChange"
        />
        <a-button v-if="authState.session" class="logout" type="link" @click="handleLogout">
          {{ t('layout.logout') }}
        </a-button>
      </a-layout-header>
      <a-layout-content class="content">
        <a-alert
          v-if="messageStore.feedback"
          :type="messageStore.feedback.kind"
          :message="messageStore.feedback.content"
          :description="
            messageStore.feedback.traceId
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
.logo {
  color: #fff;
  font-weight: 600;
  padding: 16px;
  text-align: center;
}

.header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
}

.header-spacer {
  flex: 1;
}

.header-label {
  color: rgba(0, 0, 0, 0.45);
  margin-right: 8px;
}

.locale-select {
  width: 110px;
  margin-right: 16px;
}

.tenant-select {
  width: 240px;
}

.logout {
  margin-left: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.content {
  padding: 16px 24px;
}

.feedback {
  margin-bottom: 12px;
}
</style>
