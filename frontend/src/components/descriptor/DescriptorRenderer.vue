<script setup lang="ts">
/**
 * 服务详情描述符渲染器（v4 §2.2）：按供给平台发布的描述符区块序列渲染详情页。
 * 门户不硬编码任何业务内容；未知区块类型降级为只读文本块。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DescriptorAction, DescriptorSection, ServiceDescriptor } from '@/types/descriptor'
import { 中文展示 } from '@/ui-kit/展示文本'

const props = defineProps<{ descriptor: ServiceDescriptor }>()
const emit = defineEmits<{ action: [action: DescriptorAction] }>()

const { t } = useI18n()

const KNOWN_TYPES = new Set([
  'summary',
  'fields',
  'richtext',
  'sample',
  'quality',
  'versions',
  'inputs',
  'outputs',
  'semantic-deps',
  'history',
])

const sectionTitle = (section: DescriptorSection): string =>
  section.title ?? (KNOWN_TYPES.has(section.type) ? t(`descriptor.section.${section.type}`) : '')

const knownSections = computed(() => props.descriptor.sections.filter((s) => KNOWN_TYPES.has(s.type)))
const unknownSections = computed(() => props.descriptor.sections.filter((s) => !KNOWN_TYPES.has(s.type)))

const knownActions = computed(() => props.descriptor.actions)

function onAction(action: DescriptorAction) {
  emit('action', action)
}
</script>

<template>
  <div class="descriptor-renderer">
    <h2 class="descriptor-name">{{ descriptor.name }}</h2>
    <div class="descriptor-summary">
      <a-space size="small" wrap>
        <a-tag v-if="descriptor.summary.version" color="purple">
          {{ descriptor.summary.version }}
        </a-tag>
        <a-tag v-if="descriptor.summary.status" color="blue">{{ 中文展示(descriptor.summary.status) }}</a-tag>
        <a-tag v-for="badge in descriptor.summary.badges ?? []" :key="badge">{{ 中文展示(badge) }}</a-tag>
      </a-space>
    </div>

    <section v-for="section in knownSections" :key="`${section.type}-${section.title ?? ''}`" class="descriptor-section">
      <h3 class="section-title">{{ sectionTitle(section) }}</h3>

      <a-descriptions v-if="section.type === 'summary'" :column="2" size="small" bordered>
        <a-descriptions-item v-for="field in section.fields ?? []" :key="field.label" :label="field.label">
          {{ field.value }}
        </a-descriptions-item>
      </a-descriptions>

      <a-table
        v-else-if="section.type === 'fields'"
        :columns="[
          { title: t('descriptor.fieldLabel'), dataIndex: 'label' },
          { title: t('descriptor.fieldValue'), dataIndex: 'value' },
        ]"
        :data-source="section.fields ?? []"
        :pagination="false"
        row-key="label"
        size="small"
      />

      <p v-else-if="section.type === 'richtext'" class="richtext">{{ section.text }}</p>

      <template v-else-if="section.type === 'sample'">
        <a-table
          :columns="(section.sample?.columns ?? []).map((c) => ({ title: c, dataIndex: c }))"
          :data-source="(section.sample?.rows ?? []).map((row) => ({ __row: row.join('|'), ...Object.fromEntries(row.map((cell, ci) => [section.sample!.columns[ci], cell])) }))"
          :pagination="{ pageSize: 5, hideOnSinglePage: true }"
          row-key="__row"
          size="small"
        />
        <p v-if="section.sample?.note" class="sample-note">{{ section.sample.note }}</p>
      </template>

      <div v-else-if="section.type === 'quality'" class="quality-grid">
        <div
          v-for="metric in section.metrics ?? []"
          :key="metric.label"
          class="quality-metric"
          :data-state="metric.state ?? 'success'"
        >
          <span class="quality-value">{{ metric.value }}</span>
          <span class="quality-label">{{ metric.label }}</span>
        </div>
      </div>

      <a-timeline v-else-if="section.type === 'versions'">
        <a-timeline-item
          v-for="item in section.versions ?? []"
          :key="item.version"
          :color="item.current ? 'blue' : 'gray'"
        >
          <span class="version-line">
            <strong>{{ item.version }}</strong>
            <span class="version-date">{{ item.releasedAt }}</span>
            <a-tag v-if="item.current" color="blue">{{ t('descriptor.currentVersion') }}</a-tag>
          </span>
          <p v-if="item.note" class="version-note">{{ item.note }}</p>
        </a-timeline-item>
      </a-timeline>

      <a-table
        v-else-if="section.type === 'inputs'"
        :columns="[
          { title: t('descriptor.inputName'), dataIndex: 'label' },
          { title: t('descriptor.inputKindLabel'), dataIndex: 'kindLabel' },
          { title: t('descriptor.required'), dataIndex: 'requiredLabel' },
          { title: t('common.description'), dataIndex: 'hint' },
        ]"
        :data-source="(section.inputs ?? []).map((input) => ({
          ...input,
          kindLabel: t(`descriptor.kinds.${input.kind}`),
          requiredLabel: input.required ? t('common.yes') : t('common.no'),
        }))"
        :pagination="false"
        row-key="key"
        size="small"
      />

      <ul v-else-if="section.type === 'outputs' || section.type === 'semantic-deps'" class="item-list">
        <li v-for="item in section.items ?? []" :key="item.label">
          <strong>{{ item.label }}</strong>
          <span v-if="item.value">：{{ item.value }}</span>
        </li>
      </ul>

      <div v-else-if="section.type === 'history'" class="history-grid">
        <div v-for="stat in section.stats ?? []" :key="stat.label" class="history-stat">
          <span class="history-value">{{ stat.value }}</span>
          <span class="history-label">{{ stat.label }}</span>
        </div>
      </div>
    </section>

    <section v-for="(section, index) in unknownSections" :key="`unknown-${index}`" class="descriptor-section">
      <h3 class="section-title">{{ section.title ?? section.type }}</h3>
      <p class="richtext unknown-fallback">{{ section.text ?? t('descriptor.unknownSection') }}</p>
    </section>

    <div v-if="knownActions.length > 0" class="descriptor-actions">
      <a-button
        v-for="action in knownActions"
        :key="action.id"
        :type="action.kind === 'flow' && action.flow === 'run' ? 'primary' : 'default'"
        @click="onAction(action)"
      >
        {{ action.label }}
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.descriptor-renderer {
  display: grid;
  gap: var(--od-space-3, 24px);
}

.descriptor-name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}

.descriptor-summary {
  margin-bottom: -8px;
}

.descriptor-section {
  padding: var(--od-space-2, 16px);
  border: 1px solid var(--od-color-line-soft, #e8eef3);
  border-radius: var(--od-radius-card, 12px);
  background: var(--od-color-panel, #fff);
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}

.richtext {
  margin: 0;
  color: var(--od-color-ink-soft, #334e68);
  line-height: 1.7;
  white-space: pre-wrap;
}

.unknown-fallback {
  color: var(--od-color-muted, #52677a);
  font-size: 13px;
}

.sample-note {
  margin: 8px 0 0;
  color: var(--od-color-muted, #52677a);
  font-size: 12px;
}

.quality-grid,
.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.quality-metric,
.history-stat {
  display: grid;
  gap: 4px;
  border: 1px solid var(--od-color-line-soft, #e8eef3);
  border-radius: 8px;
  padding: 12px;
  background: var(--od-color-paper, #f4f7fb);
}

.quality-value,
.history-value {
  font-family: var(--od-font-mono, monospace);
  font-size: 18px;
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}

.quality-metric[data-state='warning'] .quality-value {
  color: var(--od-color-warning, #d68a1f);
}

.quality-metric[data-state='blocked'] .quality-value {
  color: var(--od-color-blocked, #c53030);
}

.quality-label,
.history-label {
  color: var(--od-color-muted, #52677a);
  font-size: 12px;
}

.version-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.version-date {
  color: var(--od-color-muted, #52677a);
  font-size: 12px;
}

.version-note {
  margin: 4px 0 0;
  color: var(--od-color-ink-soft, #334e68);
  font-size: 12px;
}

.item-list {
  margin: 0;
  padding-left: 18px;
  color: var(--od-color-ink-soft, #334e68);
  line-height: 1.9;
}

.descriptor-actions {
  display: flex;
  gap: 12px;
}
</style>
