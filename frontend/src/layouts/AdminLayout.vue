<script setup lang="ts">
import {
  ArrowLeftOutlined,
  AuditOutlined,
  FileSearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const items = [
  { key: '/admin/requirements', labelKey: 'menu.adminRequirements', icon: FileSearchOutlined },
  { key: '/admin/approvals', labelKey: 'menu.adminApprovals', icon: AuditOutlined },
  { key: '/admin/iam', labelKey: 'menu.adminIam', icon: TeamOutlined },
  { key: '/admin/operations', labelKey: 'menu.adminOperations', icon: SettingOutlined },
]

const selectedKeys = computed(() => {
  const match = items.find((item) => route.path.startsWith(item.key))
  return [match?.key ?? '/admin/operations']
})

function go(key: string) {
  void router.push(key)
}

function onNavClick(info: { key: string | number }) {
  go(String(info.key))
}

function backToUser() {
  void router.push('/personal')
}
</script>

<template>
  <div class="admin-shell">
    <div class="admin-body">
      <aside class="admin-nav">
        <div class="admin-nav-head">
          <span class="admin-badge">{{ t('admin.badge') }}</span>
          <span class="admin-nav-title">{{ t('menu.admin') }}</span>
        </div>
        <a-menu mode="inline" :selected-keys="selectedKeys" class="admin-menu" @click="onNavClick">
          <a-menu-item v-for="item in items" :key="item.key">
            <component :is="item.icon" />
            <span>{{ t(item.labelKey) }}</span>
          </a-menu-item>
        </a-menu>
        <div class="admin-nav-foot">
          <a-button type="link" size="small" class="admin-back" @click="backToUser">
            <template #icon><ArrowLeftOutlined /></template>
            {{ t('admin.backToUser') }}
          </a-button>
        </div>
      </aside>
      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100%;
  border-radius: var(--od-radius-card, 12px);
  overflow: hidden;
  box-shadow: var(--od-shadow-2);
}

.admin-body {
  display: flex;
  min-height: 0;
  background: #fff;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  width: 210px;
  flex: 0 0 210px;
  border-right: 1px solid var(--od-gray-200, #e2e8f0);
  background: #fafbfc;
  padding: 12px 0 8px;
}

.admin-nav-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 14px 12px;
  border-bottom: 1px solid var(--od-gray-200, #e2e8f0);
  margin-bottom: 6px;
}

.admin-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  background: rgba(37, 99, 235, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 999px;
  color: var(--od-color-primary, #1e40af);
  letter-spacing: 0.05em;
}

.admin-nav-title {
  font-weight: 650;
  font-size: 14px;
  color: var(--od-gray-800, #1e293b);
}

.admin-menu {
  background: transparent !important;
  border-right: 0 !important;
  flex: 1;
}

:deep(.admin-menu .ant-menu-item) {
  margin: 4px 8px !important;
  border-radius: 8px !important;
  font-weight: 500;
}

:deep(.admin-menu .ant-menu-item-selected) {
  background: var(--od-primary-50, #eff6ff) !important;
  color: var(--od-color-primary, #1e40af) !important;
  font-weight: 600;
}

.admin-nav-foot {
  padding: 8px 14px;
  border-top: 1px solid var(--od-gray-200, #e2e8f0);
}

.admin-back {
  color: var(--od-gray-500, #64748b);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 0;
}

.admin-back:hover {
  color: var(--od-color-accent, #2563eb);
}

.admin-content {
  flex: 1;
  padding: 20px 24px;
  min-width: 0;
  background: #fff;
}
</style>
