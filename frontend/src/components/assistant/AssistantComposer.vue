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
    />
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
  background: #fff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 28px;
  box-shadow: 0 8px 28px rgb(15 23 42 / 6%);
  padding: 14px 16px 10px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.composer:focus-within {
  border-color: var(--od-primary-300, #7a9fc4);
  box-shadow: 0 10px 32px rgb(31 78 121 / 12%);
}

.composer.hero {
  max-width: 720px;
}

.hero-input {
  display: block;
  width: 100%;
  min-height: 28px;
  max-height: 160px;
  border: 0;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.6;
  color: var(--od-gray-800, #1e293b);
  background: transparent;
  font-family: inherit;
}

.hero-input::placeholder {
  color: var(--od-gray-400, #94a3b8);
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: var(--od-gray-400, #94a3b8);
}

.send-btn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--od-primary-500, #1f4e79);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  transform: translateY(-1px);
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
