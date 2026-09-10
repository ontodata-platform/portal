<script setup lang="ts">
/**
 * 收藏与历史（B5）：个人中心签页。
 * 收藏=手动星标的数据服务（去看看直达详情）；浏览历史=详情访问记录（去重置顶，可清空）。
 */
import { ArrowRightOutlined, ClearOutlined, StarFilled } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useFavoritesStore } from '@/stores/favorites'
import EmptyState from '@/ui-kit/EmptyState.vue'

const { t } = useI18n()
const router = useRouter()
const favoritesStore = useFavoritesStore()

function openDetail(code: string): void {
  router.push(`/data-workbench/${encodeURIComponent(code)}`)
}
</script>

<template>
  <div class="favorites-section">
    <a-card :bordered="false" class="fav-card">
      <h3 class="fav-title"><StarFilled class="fav-star" /> {{ t('personal.favoritesTab.favoritesTitle') }}</h3>
      <EmptyState
        v-if="favoritesStore.favorites.length === 0"
        :title="t('personal.favoritesTab.favoritesEmpty')"
        :description="t('personal.favoritesTab.favoritesEmptyDesc')"
      />
      <ul v-else class="fav-list">
        <li v-for="item in favoritesStore.favorites" :key="item.code" class="fav-item">
          <span class="fav-name">{{ item.name }}</span>
          <span class="cell-mono fav-code">{{ item.code }}</span>
          <span class="fav-actions">
            <a-button size="small" type="link" @click="openDetail(item.code)">
              {{ t('personal.favoritesTab.open') }}
              <ArrowRightOutlined />
            </a-button>
            <a-button size="small" type="link" danger @click="favoritesStore.removeFavorite(item.code)">
              {{ t('personal.favoritesTab.remove') }}
            </a-button>
          </span>
        </li>
      </ul>
    </a-card>

    <a-card :bordered="false" class="fav-card">
      <h3 class="fav-title">
        {{ t('personal.favoritesTab.historyTitle') }}
        <a-button
          v-if="favoritesStore.history.length > 0"
          size="small"
          type="link"
          danger
          @click="favoritesStore.clearHistory()"
        >
          <ClearOutlined />
          {{ t('personal.favoritesTab.clearHistory') }}
        </a-button>
      </h3>
      <EmptyState v-if="favoritesStore.history.length === 0" :title="t('personal.favoritesTab.historyEmpty')" />
      <ul v-else class="fav-list">
        <li v-for="item in favoritesStore.history" :key="item.code" class="fav-item">
          <span class="fav-name">{{ item.name }}</span>
          <span class="cell-mono fav-code">{{ item.code }}</span>
          <span class="fav-date">{{ item.visitedAt.slice(0, 10) }}</span>
          <a-button size="small" type="link" @click="openDetail(item.code)">
            {{ t('personal.favoritesTab.open') }}
            <ArrowRightOutlined />
          </a-button>
        </li>
      </ul>
    </a-card>
  </div>
</template>

<style scoped>
.favorites-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fav-card {
  border-radius: 12px;
}

.fav-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.fav-star {
  color: #f59e0b;
}

.fav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.fav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
}

.fav-name {
  flex: 1;
  font-size: 13px;
}

.fav-code,
.fav-date {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.fav-actions {
  display: inline-flex;
}
</style>
