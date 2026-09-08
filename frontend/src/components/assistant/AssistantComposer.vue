<script setup lang="ts">
import { ArrowUpOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string
  loading?: boolean
  autofocus?: boolean
  variant?: 'hero' | 'dock'
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()
const { t } = useI18n()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function submit() {
  if (props.loading || !props.modelValue.trim()) return
  emit('submit')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="composer" :class="variant || 'dock'">
    <textarea
      class="hero-input"
      :value="modelValue"
      :placeholder="t('assistant.inputPlaceholder')"
      :autofocus="!!autofocus"
      rows="1"
      @input="onInput"
      @keydown="onKeydown"
    ></textarea>
    <div class="bar">
      <span class="hint">{{ t('assistant.composerHint') }}</span>
      <button
        type="button"
        class="send-btn"
        :disabled="loading || !modelValue.trim()"
        :aria-label="t('assistant.send')"
        @click="submit"
      >
        <ArrowUpOutlined />
        <span class="sr-only">{{ t('assistant.send') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  width: 100%;
  background: #ffffff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
  padding: 14px 18px 10px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.composer:focus-within {
  border-color: var(--od-color-accent, #2563eb);
  box-shadow: 0 8px 30px rgba(37, 99, 235, 0.14);
}

.composer.hero {
  position: relative;
  max-width: 860px;
  min-height: 148px;
  padding: 0;
  overflow: hidden;
  border-color: transparent;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
}

.composer.hero:focus-within {
  border-color: transparent;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08), 0 14px 36px rgba(37, 99, 235, 0.14);
}

.composer.hero .hero-input {
  min-height: 148px;
  padding: 20px 22px 60px;
  font-size: 16px;
  line-height: 1.65;
}

.composer.hero .bar {
  position: absolute;
  right: 16px;
  bottom: 12px;
  left: 20px;
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.composer.hero .hint {
  font-size: 13px;
}

.composer.hero .send-btn {
  width: 42px;
  height: 42px;
}

.hero-input {
  display: block;
  width: 100%;
  min-height: 32px;
  max-height: 160px;
  border: 0;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.6;
  color: var(--od-gray-900, #0f172a);
  background: transparent;
  font-family: inherit;
}

.hero-input::placeholder {
  color: var(--od-gray-500, #64748b);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  gap: 12px;
  border-top: 1px solid var(--od-gray-100, #f1f5f9);
  padding-top: 8px;
}

.hint {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.send-btn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
  transition: all 0.15s ease;
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  box-shadow: none;
}

.send-btn:not(:disabled):hover {
  transform: scale(1.05);
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
