<script setup lang="ts">
import {
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CarryOutOutlined,
  DeploymentUnitOutlined,
  FileDoneOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { authState, clearSession } from '@/auth/session'
import { setLocale } from '@/i18n'
import { useLocalMock } from '@/mocks/localMode'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const identityStore = useIdentityStore()

const collapsed = ref(false)

/**
 * 分组导航菜单定义（三层信息架构，2026-09-01 收敛）：
 * 1. 服务门户（用户闭环主干）：个人工作台、数据商城、算法工作台、任务中心、
 *    审批中心、结果中心、通知中心——用户完成"发现→运行→交付"的主链路
 * 2. 协同与智能（第二层）：统一搜索、需求管理、应用编排、智能体会话——跨系统协同与智能辅助
 * 3. 运营管理（第三层）：门户运营（仅在具备 operator/admin 角色或 devMode 时显示）——平台运维功能不与用户主干混排
 */
const menuGroups = computed(() => {
  const groups = [
    {
      key: 'groupPortal',
      title: t('menu.groupPortal'),
      items: [
        { key: '/personal', label: t('menu.personal'), icon: UserOutlined },
        { key: '/marketplace', label: t('menu.marketplace'), icon: ShopOutlined },
        { key: '/workbench', label: t('menu.workbench'), icon: AppstoreOutlined },
        { key: '/tasks', label: t('menu.tasks'), icon: CarryOutOutlined },
        { key: '/approvals', label: t('menu.approvals'), icon: AuditOutlined },
        { key: '/results', label: t('menu.results'), icon: FileDoneOutlined },
        { key: '/notifications', label: t('menu.notifications'), icon: BellOutlined },
      ],
    },
    {
      key: 'groupCollab',
      title: t('menu.groupCollab'),
      items: [
        { key: '/search', label: t('menu.search'), icon: SearchOutlined },
        { key: '/requirements', label: t('menu.requirements'), icon: SolutionOutlined },
        { key: '/scenarios', label: t('menu.scenarios'), icon: DeploymentUnitOutlined },
        { key: '/agent/chat', label: t('menu.agentChat'), icon: RobotOutlined },
      ],
    },
  ]

  if (identityStore.canAccessOperations) {
    groups.push({
      key: 'groupOperations',
      title: t('menu.groupOperations'),
      items: [{ key: '/operations', label: t('menu.operations'), icon: SettingOutlined }],
    })
  }

  return groups
})

/** 选中的路由键：详情子路由高亮所属根菜单。 */
const selectedKeys = computed(() => {
  const path = route.path
  if (path.startsWith('/marketplace')) {
    return ['/marketplace']
  }
  if (path.startsWith('/workbench')) {
    return ['/workbench']
  }
  return [path]
})

const pageTitle = computed(() =>
  route.meta.titleKey ? t(route.meta.titleKey as string) : t('layout.appName'),
)

/** 语言清单：切换即时生效并持久化（M5 国际化）。 */
const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
]

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  router.push(key as string)
}

const handleLocaleChange = (value: unknown) => {
  setLocale(String(value ?? 'zh-CN'))
}

/** 退出登录（M5 IAM）：清除会话后回登录页。 */
const handleLogout = () => {
  clearSession()
  identityStore.reset()
  router.push('/login')
}

onMounted(() => {
  void identityStore.fetchIdentity()
})
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider
      v-model:collapsed="collapsed"
      collapsible
      theme="dark"
      width="240"
      class="portal-sider"
    >
      <div class="logo">
        <span class="logo-text">{{ t('layout.appName') }}</span>
      </div>
      <a-menu
        theme="dark"
        mode="inline"
        :selected-keys="selectedKeys"
        @click="handleMenuClick"
      >
        <a-menu-item-group v-for="group in menuGroups" :key="group.key" :title="group.title">
          <a-menu-item v-for="item in group.items" :key="item.key">
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
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

        <div class="header-spacer"></div>

        <div class="header-right">
          <a-tag v-if="useLocalMock" color="cyan" class="badge-dev">
            {{ t('layout.localMock') }}
          </a-tag>
          <a-tag v-if="identityStore.devMode" color="orange" class="badge-dev">
            {{ t('layout.devMode') }}
          </a-tag>

          <span class="identity-info">
            <UserOutlined style="margin-right: 4px" />
            <span class="user-name">{{ identityStore.name }}</span>
            <a-tag color="blue" class="tenant-badge">{{ identityStore.tenantId }}</a-tag>
          </span>

          <span class="header-label">{{ t('layout.locale') }}</span>
          <a-select
            :value="$i18n.locale"
            :options="localeOptions"
            class="locale-select"
            @change="handleLocaleChange"
          />

          <a-button v-if="authState.session" class="logout" type="link" @click="handleLogout">
            {{ t('layout.logout') }}
          </a-button>
        </div>
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
.portal-sider {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, 0.05);
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

.header {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-trigger {
  font-size: 16px;
  cursor: pointer;
  transition: color 0.3s;
}

.collapse-trigger:hover {
  color: #1890ff;
}

.header-spacer {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.identity-info {
  display: flex;
  align-items: center;
  margin-right: 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.75);
}

.user-name {
  font-weight: 500;
  margin-right: 6px;
}

.tenant-badge {
  margin-left: 2px;
}

.badge-dev {
  font-weight: 600;
}

.header-label {
  color: rgba(0, 0, 0, 0.45);
  margin-left: 4px;
}

.locale-select {
  width: 100px;
}

.logout {
  margin-left: 4px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.content {
  padding: 20px 24px;
  background: #f0f2f5;
  min-height: calc(100vh - 60px);
}

.feedback {
  margin-bottom: 16px;
}
</style>
