<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError, parseJsonOrThrow } from '@/api/client'
import { scenarioApi, type ScenarioUpsertBody } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalScenario, ScenarioBinding, ScenarioOntologyRef } from '@/types/portal'

/**
 * 场景编排页（批次 D 后段，scenario/v1）：场景列表 + 创建/编辑（装配字段以 JSON 声明）+
 * 发布/下线 + 新草稿版本。钉扎校验双保险：提交前前端预检（版本必须 x.y.z，禁止 latest/通配符），
 * 后端 400 的字段错误在弹窗内联展示（钉扎校验错误可见、可定位）。
 */
const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalScenario[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', keyword: '' })

/** 弹窗编辑目标：null=创建；否则为该 (code, version) 草稿的编辑。 */
const editing = ref<PortalScenario | null>(null)
const editOpen = ref(false)
const saving = ref(false)
/** 钉扎/装配校验错误（前端预检或后端 400），弹窗内联展示。 */
const formError = ref('')

const form = reactive({
  name: '',
  description: '',
  projectId: '',
  ontologyRefsText: '',
  bindingsText: '',
  presentationText: '',
})

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.currentVersion'), dataIndex: 'version', key: 'version' },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
])

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  DEPRECATED: 'warning',
}

/** 场景状态展示文案（协议编码不变，界面按语言翻译）。 */
const statusText = computed(
  () =>
    ({
      DRAFT: t('scenarios.draft'),
      PUBLISHED: t('scenarios.published'),
      DEPRECATED: t('scenarios.deprecated'),
    }) as Record<string, string>,
)

/** 精确语义版本（与 scenario/v1 钉扎不变量一致：禁止 latest/通配符）。 */
const SEMVER = /^\d+\.\d+\.\d+$/

async function load() {
  loading.value = true
  try {
    const page = await scenarioApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      keyword: query.keyword || undefined,
    })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.description = ''
  form.projectId = ''
  form.ontologyRefsText = ''
  form.bindingsText = JSON.stringify(
    [
      {
        type: 'DATA_SNAPSHOT',
        ref: 'snap-example',
        version: '1.0.0',
        alias: 'data',
        sourceSystem: 'DATA_PLATFORM',
      },
    ],
    null,
    2,
  )
  form.presentationText = ''
  formError.value = ''
  editOpen.value = true
}

function openEdit(record: PortalScenario) {
  editing.value = record
  form.name = record.name
  form.description = record.description ?? ''
  form.projectId = record.projectId ?? ''
  form.ontologyRefsText = record.ontologyRefs ? JSON.stringify(record.ontologyRefs, null, 2) : ''
  form.bindingsText = JSON.stringify(record.bindings, null, 2)
  form.presentationText = record.presentation ? JSON.stringify(record.presentation, null, 2) : ''
  formError.value = ''
  editOpen.value = true
}

/**
 * 组装请求体并做钉扎预检：bindings 至少一条；bindings/ontologyRefs 版本全部精确钉扎 x.y.z
 * （latest/通配符在前端即拦截，与后端 bean validation 口径一致）。
 */
function buildPayload(): ScenarioUpsertBody {
  const bindings = parseJsonOrThrow(form.bindingsText, t('scenarios.bindings')) as ScenarioBinding[]
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.bindingsRequired'))
  }
  for (const binding of bindings) {
    if (!binding || !SEMVER.test(binding.version ?? '')) {
      throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.pinViolation', { ref: binding?.ref ?? '' }))
    }
  }
  let ontologyRefs: ScenarioOntologyRef[] | undefined
  if (form.ontologyRefsText.trim()) {
    ontologyRefs = parseJsonOrThrow(form.ontologyRefsText, t('scenarios.ontologyRefs')) as ScenarioOntologyRef[]
    for (const ref of ontologyRefs) {
      if (!ref || !SEMVER.test(ref.version ?? '')) {
        throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.pinViolation', { ref: ref?.packageCode ?? '' }))
      }
    }
  }
  return {
    name: form.name,
    description: form.description || undefined,
    projectId: form.projectId || undefined,
    ontologyRefs,
    bindings,
    presentation: form.presentationText.trim()
      ? (parseJsonOrThrow(form.presentationText, t('scenarios.presentation')) as ScenarioUpsertBody['presentation'])
      : undefined,
  }
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const payload = buildPayload()
    if (editing.value) {
      await scenarioApi.update(editing.value.code, editing.value.version, payload)
      messageStore.success(t('scenarios.saved', { code: editing.value.code, version: editing.value.version }))
    } else {
      const created = await scenarioApi.create(payload)
      messageStore.success(t('scenarios.created', { code: created.code }))
    }
    editOpen.value = false
    await load()
  } catch (error) {
    // 钉扎/装配校验错误（前端预检 ApiError 或后端 400 fieldErrors）弹窗内联展示，不关窗
    formError.value = error instanceof ApiError ? error.detail : String(error)
  } finally {
    saving.value = false
  }
}

async function transition(action: () => Promise<unknown>, successText: string) {
  try {
    await action()
    messageStore.success(successText)
    await load()
  } catch (error) {
    messageStore.reportError(error)
  }
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="query.status" :placeholder="t('scenarios.statusPlaceholder')" allow-clear style="width: 150px">
        <a-select-option value="DRAFT">{{ t('scenarios.draft') }}</a-select-option>
        <a-select-option value="PUBLISHED">{{ t('scenarios.published') }}</a-select-option>
        <a-select-option value="DEPRECATED">{{ t('scenarios.deprecated') }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" :placeholder="t('scenarios.keywordPlaceholder')" style="width: 180px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        {{ t('common.query') }}
      </a-button>
      <a-button @click="openCreate">{{ t('scenarios.createButton') }}</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :row-key="(record: PortalScenario) => `${record.code}@${record.version}`"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status]">{{ statusText[record.status] ?? record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="record.status === 'DRAFT'" size="small" @click="openEdit(record)">
              {{ t('scenarios.edit') }}
            </a-button>
            <a-button
              v-if="record.status === 'DRAFT'"
              size="small"
              type="primary"
              @click="transition(() => scenarioApi.publish(record.code, record.version), t('scenarios.publishedMessage', { code: record.code, version: record.version }))"
            >
              {{ t('scenarios.publish') }}
            </a-button>
            <a-button
              v-if="record.status === 'PUBLISHED'"
              size="small"
              danger
              @click="transition(() => scenarioApi.deprecate(record.code, record.version), t('scenarios.deprecatedMessage', { code: record.code, version: record.version }))"
            >
              {{ t('scenarios.deprecate') }}
            </a-button>
            <a-button
              v-if="record.status === 'PUBLISHED' || record.status === 'DEPRECATED'"
              size="small"
              @click="transition(() => scenarioApi.createDraft(record.code), t('scenarios.draftCreated', { code: record.code }))"
            >
              {{ t('scenarios.newDraft') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="editOpen"
      :title="editing ? t('scenarios.editModal', { code: editing.code, version: editing.version }) : t('scenarios.createModal')"
      :confirm-loading="saving"
      width="720px"
      @ok="save"
    >
      <a-alert
        v-if="formError"
        type="error"
        :message="formError"
        show-icon
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item :label="t('common.name')" required>
          <a-input v-model:value="form.name" :placeholder="t('scenarios.namePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('scenarios.description')">
          <a-input v-model:value="form.description" :placeholder="t('scenarios.descriptionPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('scenarios.projectId')">
          <a-input v-model:value="form.projectId" :placeholder="t('scenarios.projectIdPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('scenarios.ontologyRefs')">
          <a-textarea v-model:value="form.ontologyRefsText" :placeholder="t('scenarios.ontologyRefsPlaceholder')" :rows="3" />
        </a-form-item>
        <a-form-item :label="t('scenarios.bindings')" required>
          <a-textarea v-model:value="form.bindingsText" :placeholder="t('scenarios.bindingsPlaceholder')" :rows="8" />
        </a-form-item>
        <a-form-item :label="t('scenarios.presentation')">
          <a-textarea v-model:value="form.presentationText" :placeholder="t('scenarios.presentationPlaceholder')" :rows="4" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
