<script setup lang="ts">
import { ApartmentOutlined, DatabaseOutlined, SettingOutlined } from '@ant-design/icons-vue'
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
      <span class="admin-badge">{{ t('admin.badge') }}</span>
      <span class="admin-title">{{ t('menu.admin') }}</span>
      <a-button type="link" class="admin-back" @click="backToUser">{{ t('admin.backToUser') }}</a-button>
    </div>
    <div class="admin-body">
      <aside class="admin-nav">
        <a-menu mode="inline" :selected-keys="selectedKeys" @click="onNavClick">
          <a-menu-item v-for="item in items" :key="item.key">
            <component :is="item.icon" />
            <span>{{ t(item.labelKey) }}</span>
          </a-menu-item>
        </a-menu>
      </aside>
      <div class="admin-content">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 100px);
}

.admin-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #0d2b45;
  color: #fff;
  border-radius: 8px 8px 0 0;
}

.admin-badge {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
}

.admin-title {
  font-weight: 600;
}

.admin-back {
  margin-left: auto;
  color: #d6e4f0;
}

.admin-body {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #fff;
  border: 1px solid #e8eef4;
  border-top: 0;
  border-radius: 0 0 8px 8px;
}

.admin-nav {
  width: 200px;
  border-right: 1px solid #f0f0f0;
}

.admin-content {
  flex: 1;
  padding: 16px;
  min-width: 0;
}
</style>
