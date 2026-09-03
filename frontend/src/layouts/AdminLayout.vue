<script setup lang="ts">
import { ApartmentOutlined, ArrowLeftOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const items = [
  { key: '/admin/operations', labelKey: 'menu.adminOperations', icon: SettingOutlined },
  { key: '/admin/assemblies', labelKey: 'menu.adminAssemblies', icon: ApartmentOutlined },
  { key: '/admin/platform', labelKey: 'menu.adminPlatform', icon: DatabaseOutlined },
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
    <div class="admin-banner">
      <div class="admin-banner-left">
        <span class="admin-badge">{{ t('admin.badge') }}</span>
        <span class="admin-title">{{ t('menu.admin') }}</span>
      </div>
      <a-button type="link" class="admin-back" @click="backToUser">
        <template #icon><ArrowLeftOutlined /></template>
        {{ t('admin.backToUser') }}
      </a-button>
    </div>
    <div class="admin-body">
      <aside class="admin-nav">
        <a-menu mode="inline" :selected-keys="selectedKeys" class="admin-menu" @click="onNavClick">
          <a-menu-item v-for="item in items" :key="item.key">
            <component :is="item.icon" />
            <span>{{ t(item.labelKey) }}</span>
          </a-menu-item>
        </a-menu>
      </aside>
      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 110px);
  border-radius: var(--od-radius-card, 12px);
  overflow: hidden;
  box-shadow: var(--od-shadow-2);
}

.admin-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #fff;
}

.admin-banner-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  background: rgba(37, 99, 235, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 999px;
  color: #93c5fd;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.admin-title {
  font-weight: 650;
  font-size: 15px;
  letter-spacing: -0.01em;
}

.admin-back {
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.admin-back:hover {
  color: #60a5fa;
}

.admin-body {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #fff;
}

.admin-nav {
  width: 210px;
  border-right: 1px solid var(--od-gray-200, #e2e8f0);
  background: #fafbfc;
  padding: 8px 0;
}

.admin-menu {
  background: transparent !important;
  border-right: 0 !important;
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

.admin-content {
  flex: 1;
  padding: 20px 24px;
  min-width: 0;
  background: #fff;
}
</style>
