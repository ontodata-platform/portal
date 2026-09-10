<script setup lang="ts">
/**
 * 帮助中心（D6）：办理指南三篇 + 常见问题，手风琴展示。
 * 内容与智能服务的"办理流程咨询"模板保持同一口径。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const guides = [
  {
    key: 'data',
    title: t('help.guideData'),
    steps: [
      t('help.dataStep1'),
      t('help.dataStep2'),
      t('help.dataStep3'),
    ],
    target: '/data-workbench',
  },
  {
    key: 'algorithm',
    title: t('help.guideAlgorithm'),
    steps: [
      t('help.algoStep1'),
      t('help.algoStep2'),
      t('help.algoStep3'),
    ],
    target: '/algorithm-workbench',
  },
  {
    key: 'requirement',
    title: t('help.guideRequirement'),
    steps: [
      t('help.reqStep1'),
      t('help.reqStep2'),
      t('help.reqStep3'),
    ],
    target: '/personal/requirements',
  },
]

const openKey = ref(guides[0]?.key ?? '')

function toggle(key: string): void {
  openKey.value = openKey.value === key ? '' : key
}
</script>

<template>
  <div class="help-view">
    <h1 class="help-title">{{ t('help.title') }}</h1>
    <p class="help-sub">{{ t('help.subtitle') }}</p>

    <section
      v-for="guide in guides"
      :key="guide.key"
      class="guide-card"
    >
      <button type="button" class="guide-head" @click="toggle(guide.key)">
        <span class="guide-title">{{ guide.title }}</span>
        <span class="guide-toggle">{{ openKey === guide.key ? '−' : '+' }}</span>
      </button>
      <div v-if="openKey === guide.key" class="guide-body">
        <ol class="guide-steps">
          <li v-for="step in guide.steps" :key="step">{{ step }}</li>
        </ol>
        <a-button size="small" type="primary" ghost @click="router.push(guide.target)">
          {{ t('help.goNow') }}
        </a-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.help-view {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.help-sub {
  margin: 0 0 8px;
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
}

.guide-card {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 18px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.guide-toggle {
  color: var(--od-primary, #2563eb);
  font-size: 16px;
}

.guide-body {
  padding: 0 18px 16px;
  display: grid;
  gap: 12px;
}

.guide-steps {
  margin: 0;
  padding-left: 20px;
  color: var(--od-color-ink-soft, #334e68);
  line-height: 1.9;
  font-size: 13px;
}
</style>
