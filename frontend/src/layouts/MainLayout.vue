<script setup lang="ts">
import {
  AppstoreOutlined,
  AuditOutlined,
  CarryOutOutlined,
  FileDoneOutlined,
  HomeOutlined,
  ShopOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { useMessageStore } from '@/stores/message'
import { useTenantStore } from '@/stores/tenant'

const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const tenantStore = useTenantStore()

/** M5 多租户验收租户清单；combobox 允许输入自定义租户标识（非法时退回 default）。 */
const tenantOptions = [
  { value: 'default', label: 'default（缺省租户）' },
  { value: 'tenant-a', label: 'tenant-a（验收租户 A）' },
  { value: 'tenant-b', label: 'tenant-b（验收租户 B）' },
]

const handleTenantChange = (value: unknown) => {
  const typed = String(value ?? '')
  const effective = tenantStore.switchTenant(typed)
  if (typed.trim() !== effective) {
    messageStore.reportError(
      new ApiError(
        400,
        'INVALID_TENANT',
        '租户标识只能包含小写字母、数字与连字符（1-64 位），已恢复为缺省租户',
      ),
    )
  }
}

const menus = [
  { key: '/operations', label: '门户运营', icon: HomeOutlined },
  { key: '/marketplace', label: '数据商城', icon: ShopOutlined },
  { key: '/workbench', label: '算法工作台', icon: AppstoreOutlined },
  { key: '/tasks', label: '统一任务中心', icon: CarryOutOutlined },
  { key: '/approvals', label: '审批中心', icon: AuditOutlined },
  { key: '/results', label: '结果中心', icon: FileDoneOutlined },
  { key: '/requirements', label: '需求管理', icon: SolutionOutlined },
  { key: '/personal', label: '个人中心', icon: UserOutlined },
]

const selectedKey = computed(() => route.path)
const pageTitle = computed(() => (route.meta.title as string | undefined) ?? 'ontodata 管理门户')

const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
  router.push(key as string)
}
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider theme="dark">
      <div class="logo">ontodata 管理门户</div>
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
        <span class="tenant-label">租户</span>
        <a-select
          :value="tenantStore.tenantId"
          mode="combobox"
          :options="tenantOptions"
          class="tenant-select"
          @change="handleTenantChange"
        />
      </a-layout-header>
      <a-layout-content class="content">
        <a-alert
          v-if="messageStore.feedback"
          :type="messageStore.feedback.kind"
          :message="messageStore.feedback.content"
          :description="
            messageStore.feedback.traceId
              ? `如问题持续，请向平台管理员提供追踪编号 ${messageStore.feedback.traceId}`
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

.tenant-label {
  color: rgba(0, 0, 0, 0.45);
  margin-right: 8px;
}

.tenant-select {
  width: 240px;
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
