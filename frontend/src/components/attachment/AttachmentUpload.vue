<script setup lang="ts">
/**
 * 附件上传组件（D2）：按业务类型+业务编码管理附件列表。
 * 上传/下载/删除；类型与大小校验；真实模式契约见 stores/attachments.ts。
 */
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAttachmentsStore } from '@/stores/attachments'

const props = defineProps<{ bizType: string; bizCode: string }>()

const { t } = useI18n()
const attachmentsStore = useAttachmentsStore()
const fileInput = ref<HTMLInputElement | null>(null)
const errorText = ref('')

const items = ref(attachmentsStore.listByBiz(props.bizType, props.bizCode))

function refresh(): void {
  items.value = attachmentsStore.listByBiz(props.bizType, props.bizCode)
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  errorText.value = ''
  try {
    await attachmentsStore.add(file, props.bizType, props.bizCode)
    refresh()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  }
}

function download(item: (typeof items.value)[number]): void {
  const link = document.createElement('a')
  if (item.dataUrl) {
    link.href = item.dataUrl
  } else {
    link.href = `data:text/plain,${encodeURIComponent(item.name)}`
  }
  link.download = item.name
  link.click()
}

function remove(id: string): void {
  attachmentsStore.remove(id)
  refresh()
}
</script>

<template>
  <div class="attachment-upload">
    <input ref="fileInput" type="file" class="attachment-file-input" @change="onFileChange" />
    <a-button size="small" @click="fileInput?.click()">
      <template #icon><UploadOutlined /></template>
      {{ t('attachment.upload') }}
    </a-button>
    <p v-if="errorText" class="attachment-error">{{ errorText }}</p>
    <ul v-if="items.length > 0" class="attachment-list">
      <li v-for="item in items" :key="item.id" class="attachment-row">
        <PaperClipOutlined />
        <span class="attachment-name">{{ item.name }}</span>
        <span class="attachment-size">{{ (item.size / 1024).toFixed(0) }}KB</span>
        <a-button size="small" type="link" @click="download(item)">
          <DownloadOutlined />
          {{ t('attachment.download') }}
        </a-button>
        <a-button size="small" type="link" danger @click="remove(item.id)">
          <DeleteOutlined />
          {{ t('attachment.remove') }}
        </a-button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.attachment-file-input {
  display: none;
}

.attachment-error {
  margin: 4px 0;
  font-size: 12px;
  color: #dc2626;
}

.attachment-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.attachment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.attachment-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  color: var(--od-gray-500, #64748b);
}
</style>
