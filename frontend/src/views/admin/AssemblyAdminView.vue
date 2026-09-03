<script setup lang="ts">
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError } from '@/api/client'
import { marketplaceApi, scenarioApi, workbenchApi, type ScenarioUpsertBody } from '@/api/portal'
import { catalogItems, pinCatalogVersion } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, PortalScenario, ScenarioBinding, ScenarioOntologyRef } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import {
  WIDGET_KINDS,
  bindingAliasSet,
  buildPresentation,
  type FormWidgetItem,
} from '@/views/scenarioPresentation'

/**
 * 应用编排页（批次 D 后段，scenario/v1）：应用装配列表 + 创建/编辑 +
 * 发布/下线 + 新草稿版本。装配全部采用结构化动态行配置，严格预检语义版本钉扎（x.y.z）。
 * 本页是门户应用装配（scn-*），不是本体执行场景；对照见 contracts/governance/场景概念对照.md。
 */
const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<PortalScenario[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', keyword: '' })

/** 弹窗编辑目标：null=创建；否则为该 (code, version) 草稿的编辑。 */
const editing = ref<PortalScenario | null>(null)
const editOpen = ref(false)
const saving = ref(false)
/** 钉扎/装配校验错误（前端预检或后端 400），弹窗内联展示。 */
const formError = ref('')

interface FormBindingItem {
  type: ScenarioBinding['type']
  sourceSystem: ScenarioBinding['sourceSystem']
  ref: string
  version: string
  alias: string
}

interface FormOntologyRefItem {
  packageCode: string
  version: string
}

const form = reactive({
  name: '',
  description: '',
  projectId: '',
  ontologyRefs: [] as FormOntologyRefItem[],
  bindings: [] as FormBindingItem[],
  entryView: '',
  widgets: [] as FormWidgetItem[],
})

const bindingAliases = computed(() => [...bindingAliasSet(form.bindings)])

const capabilityCatalog = ref<CatalogEntry[]>([])
const templateCatalog = ref<CatalogEntry[]>([])
const dataServiceCatalog = ref<CatalogEntry[]>([])
const catalogAvailable = reactive({
  capability: false,
  template: false,
  dataService: false,
})

function sourceSystemOf(type: ScenarioBinding['type']): ScenarioBinding['sourceSystem'] {
  if (type === 'CAPABILITY') {
    return 'ALGORITHM_TRANSFORM'
  }
  if (type === 'WORKFLOW_TEMPLATE') {
    return 'ALGORITHM_RECOMBINE'
  }
  return 'DATA_PLATFORM'
}

function catalogFor(type: ScenarioBinding['type']): CatalogEntry[] {
  if (type === 'CAPABILITY') {
    return capabilityCatalog.value
  }
  if (type === 'WORKFLOW_TEMPLATE') {
    return templateCatalog.value
  }
  return dataServiceCatalog.value
}

function catalogReady(type: ScenarioBinding['type']): boolean {
  if (type === 'CAPABILITY') {
    return catalogAvailable.capability
  }
  if (type === 'WORKFLOW_TEMPLATE') {
    return catalogAvailable.template
  }
  return catalogAvailable.dataService
}

async function loadCatalogs() {
  const [capabilities, templates, services] = await Promise.all([
    workbenchApi.capabilities({ page: 1, size: 100 }),
    workbenchApi.workflowTemplates({ page: 1, size: 100 }),
    marketplaceApi.dataServices({ page: 1, size: 100 }),
  ])
  capabilityCatalog.value = catalogItems(capabilities)
  templateCatalog.value = catalogItems(templates)
  dataServiceCatalog.value = catalogItems(services)
  catalogAvailable.capability = capabilities.available
  catalogAvailable.template = templates.available
  catalogAvailable.dataService = services.available
}

function onBindingTypeChange(item: FormBindingItem) {
  item.sourceSystem = sourceSystemOf(item.type)
  item.ref = ''
  item.version = '1.0.0'
}

function onBindingRefChange(item: FormBindingItem, code: string) {
  item.ref = code
  const selected = catalogFor(item.type).find((entry) => entry.code === code)
  if (selected) {
    item.version = pinCatalogVersion(selected.currentVersion)
  }
}

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 160 },
  { title: t('common.currentVersion'), dataIndex: 'version', key: 'version', width: 110 },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110 },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 220 },
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

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function load() {
  loading.value = true
  loadError.value = ''
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
    loadError.value = describeLoadError(error)
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
  form.ontologyRefs = []
  form.bindings = [
    {
      type: 'WORKFLOW_TEMPLATE',
      sourceSystem: 'ALGORITHM_RECOMBINE',
      ref: '',
      version: '1.0.0',
      alias: 'flow',
    },
  ]
  form.entryView = ''
  form.widgets = []
  formError.value = ''
  editOpen.value = true
  void loadCatalogs()
}

function openEdit(record: PortalScenario) {
  editing.value = record
  form.name = record.name
  form.description = record.description ?? ''
  form.projectId = record.projectId ?? ''
  form.ontologyRefs = (record.ontologyRefs ?? []).map((ref) => ({
    packageCode: ref.packageCode,
    version: ref.version,
  }))
  form.bindings = (record.bindings ?? []).map((binding) => ({
    type: binding.type,
    sourceSystem: binding.sourceSystem || sourceSystemOf(binding.type),
    ref: binding.ref,
    version: binding.version,
    alias: binding.alias ?? '',
  }))
  form.entryView = record.presentation?.entryView ?? ''
  form.widgets = (record.presentation?.widgets ?? []).map((widget) => ({
    kind: widget.kind,
    bindingAlias: widget.bindingAlias,
  }))
  formError.value = ''
  editOpen.value = true
  void loadCatalogs()
}

function addBindingRow() {
  form.bindings.push({
    type: 'CAPABILITY',
    sourceSystem: sourceSystemOf('CAPABILITY'),
    ref: '',
    version: '1.0.0',
    alias: '',
  })
}

function removeBindingRow(index: number) {
  form.bindings.splice(index, 1)
}

function addOntologyRefRow() {
  form.ontologyRefs.push({
    packageCode: '',
    version: '1.0.0',
  })
}

function removeOntologyRefRow(index: number) {
  form.ontologyRefs.splice(index, 1)
}

function addWidgetRow() {
  form.widgets.push({
    kind: 'TABLE',
    bindingAlias: bindingAliases.value[0] ?? '',
  })
}

function removeWidgetRow(index: number) {
  form.widgets.splice(index, 1)
}

/**
 * 组装请求体并做钉扎预检：bindings 至少一条；bindings/ontologyRefs 版本全部精确钉扎 x.y.z
 */
function buildPayload(): ScenarioUpsertBody {
  if (!form.name.trim()) {
    throw new ApiError(400, 'INVALID_ARGUMENT', '场景名称不能为空')
  }

  if (form.bindings.length === 0) {
    throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.bindingsRequired'))
  }

  for (const binding of form.bindings) {
    if (!binding.ref?.trim()) {
      throw new ApiError(400, 'INVALID_ARGUMENT', '装配绑定的资源标识不能为空')
    }
    if (!binding.version || !SEMVER.test(binding.version.trim())) {
      throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.pinViolation', { ref: binding.ref || '空' }))
    }
  }

  const ontologyRefs: ScenarioOntologyRef[] = []
  for (const ref of form.ontologyRefs) {
    if (!ref.packageCode?.trim()) {
      continue
    }
    if (!ref.version || !SEMVER.test(ref.version.trim())) {
      throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.pinViolation', { ref: ref.packageCode }))
    }
    ontologyRefs.push({
      packageCode: ref.packageCode.trim(),
      version: ref.version.trim(),
    })
  }

  const bindings: ScenarioBinding[] = form.bindings.map((b) => ({
    type: b.type,
    sourceSystem: sourceSystemOf(b.type),
    ref: b.ref.trim(),
    version: b.version.trim(),
    alias: b.alias.trim() || undefined,
  }))

  let presentation: ScenarioUpsertBody['presentation']
  try {
    presentation = buildPresentation(form.entryView, form.widgets, bindingAliasSet(form.bindings))
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'WIDGET_ALIAS_REQUIRED') {
      throw new ApiError(400, 'INVALID_ARGUMENT', t('scenarios.widgetAliasRequired'))
    }
    if (code.startsWith('WIDGET_ALIAS_UNKNOWN:')) {
      throw new ApiError(
        400,
        'INVALID_ARGUMENT',
        t('scenarios.widgetAliasUnknown', { alias: code.slice('WIDGET_ALIAS_UNKNOWN:'.length) }),
      )
    }
    throw error
  }

  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    projectId: form.projectId.trim() || undefined,
    ontologyRefs: ontologyRefs.length > 0 ? ontologyRefs : undefined,
    bindings,
    presentation,
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
  <div class="assembly-admin-view">
    <PageHeader
      :eyebrow="t('menu.groupCollab')"
      :title="t('menu.scenarios')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="scenarios-card">
      <div class="toolbar-area">
        <a-space wrap>
          <a-select v-model:value="query.status" :placeholder="t('scenarios.statusPlaceholder')" allow-clear style="width: 140px">
            <a-select-option value="DRAFT">{{ t('scenarios.draft') }}</a-select-option>
            <a-select-option value="PUBLISHED">{{ t('scenarios.published') }}</a-select-option>
            <a-select-option value="DEPRECATED">{{ t('scenarios.deprecated') }}</a-select-option>
          </a-select>
          <a-input
            v-model:value="query.keyword"
            :placeholder="t('scenarios.keywordPlaceholder')"
            style="width: 180px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button
            type="primary"
            @click="
              query.page = 1;
              load();
            "
          >
            {{ t('common.query') }}
          </a-button>
        </a-space>

        <a-button type="primary" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          {{ t('scenarios.createButton') }}
        </a-button>
      </div>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('scenarios.emptyTitle')"
        :description="t('scenarios.emptyDesc')"
        :action-label="t('scenarios.createButton')"
        @action="openCreate"
      />
      <a-table
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :row-key="(record: PortalScenario) => `${record.code}@${record.version}`"
        class="scenario-table"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1;
            load();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono-code">{{ record.code }}</span>
          </template>
          <template v-else-if="column.key === 'version'">
            <a-tag color="blue">v{{ record.version }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]">{{ statusText[record.status] ?? record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space size="small">
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

      <!-- 场景编辑/创建弹窗（动态行选择器） -->
      <a-modal
        v-model:open="editOpen"
        :title="editing ? t('scenarios.editModal', { code: editing.code, version: editing.version }) : t('scenarios.createModal')"
        :confirm-loading="saving"
        width="880px"
        @ok="save"
      >
        <a-alert
          v-if="formError"
          type="error"
          :message="formError"
          show-icon
          style="margin-bottom: 16px; border-radius: 8px"
        />
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="14">
              <a-form-item :label="t('common.name')" required>
                <a-input v-model:value="form.name" :placeholder="t('scenarios.namePlaceholder')" />
              </a-form-item>
            </a-col>
            <a-col :span="10">
              <a-form-item :label="t('scenarios.projectId')">
                <a-input v-model:value="form.projectId" :placeholder="t('scenarios.projectIdPlaceholder')" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item :label="t('scenarios.description')">
            <a-input v-model:value="form.description" :placeholder="t('scenarios.descriptionPlaceholder')" />
          </a-form-item>

          <!-- 装配绑定列表（动态行） -->
          <a-divider orientation="left" style="font-size: 14px; margin: 16px 0 12px 0">
            {{ t('scenarios.bindings') }}
          </a-divider>

          <a-alert
            v-if="!catalogAvailable.capability || !catalogAvailable.template"
            type="info"
            show-icon
            style="margin-bottom: 8px; border-radius: 6px"
            :message="t('scenarios.catalogUnavailable')"
          />
          <a-alert
            v-if="form.bindings.some((row) => row.type === 'DATA_SNAPSHOT')"
            type="info"
            show-icon
            style="margin-bottom: 8px; border-radius: 6px"
            :message="t('scenarios.snapshotHint')"
          />

          <div v-for="(item, idx) in form.bindings" :key="idx" class="binding-row">
            <a-row :gutter="8" align="middle">
              <a-col :span="5">
                <a-select v-model:value="item.type" style="width: 100%" @change="onBindingTypeChange(item)">
                  <a-select-option value="DATA_SNAPSHOT">数据快照</a-select-option>
                  <a-select-option value="CAPABILITY">算法能力</a-select-option>
                  <a-select-option value="WORKFLOW_TEMPLATE">工作流模板</a-select-option>
                </a-select>
              </a-col>
              <a-col :span="7">
                <a-select
                  v-if="item.type !== 'DATA_SNAPSHOT' && catalogReady(item.type)"
                  :value="item.ref"
                  show-search
                  option-filter-prop="label"
                  style="width: 100%"
                  :placeholder="t('scenarios.catalogSelectPlaceholder')"
                  :options="
                    catalogFor(item.type).map((entry) => ({
                      value: entry.code,
                      label: `${entry.name} (${entry.code})`,
                    }))
                  "
                  @change="(value: string) => onBindingRefChange(item, value)"
                />
                <a-input
                  v-else
                  v-model:value="item.ref"
                  :placeholder="item.type === 'DATA_SNAPSHOT' ? 'snap-*' : t('scenarios.bindingRef')"
                />
              </a-col>
              <a-col :span="5">
                <a-input v-model:value="item.version" :placeholder="t('scenarios.bindingVersion')" />
              </a-col>
              <a-col :span="5">
                <a-input v-model:value="item.alias" :placeholder="t('scenarios.bindingAlias')" />
              </a-col>
              <a-col :span="2" style="text-align: center">
                <a-button
                  type="text"
                  danger
                  size="small"
                  :disabled="form.bindings.length <= 1"
                  @click="removeBindingRow(idx)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-col>
            </a-row>
          </div>

          <a-button type="dashed" block style="margin-top: 8px" @click="addBindingRow">
            <template #icon><PlusOutlined /></template>
            {{ t('scenarios.addBinding') }}
          </a-button>

          <!-- 本体包引用列表（动态行） -->
          <a-divider orientation="left" style="font-size: 14px; margin: 20px 0 12px 0">
            {{ t('scenarios.ontologyRefs') }}
          </a-divider>

          <div v-for="(item, idx) in form.ontologyRefs" :key="idx" class="binding-row">
            <a-row :gutter="8" align="middle">
              <a-col :span="13">
                <a-input v-model:value="item.packageCode" :placeholder="t('scenarios.packageCode')" />
              </a-col>
              <a-col :span="9">
                <a-input v-model:value="item.version" :placeholder="t('scenarios.bindingVersion')" />
              </a-col>
              <a-col :span="2" style="text-align: center">
                <a-button type="text" danger size="small" @click="removeOntologyRefRow(idx)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-col>
            </a-row>
          </div>

          <a-button type="dashed" block style="margin-top: 8px" @click="addOntologyRefRow">
            <template #icon><PlusOutlined /></template>
            {{ t('scenarios.addOntologyRef') }}
          </a-button>

          <a-divider orientation="left" style="font-size: 14px; margin: 20px 0 12px 0">
            {{ t('scenarios.presentation') }}
          </a-divider>

          <a-form-item :label="t('scenarios.entryView')">
            <a-input v-model:value="form.entryView" :placeholder="t('scenarios.entryViewPlaceholder')" />
          </a-form-item>

          <a-alert
            v-if="form.widgets.length > 0 && bindingAliases.length === 0"
            type="warning"
            show-icon
            style="margin-bottom: 8px; border-radius: 6px"
            :message="t('scenarios.widgetNeedAlias')"
          />

          <div v-for="(item, idx) in form.widgets" :key="idx" class="binding-row">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-select v-model:value="item.kind" style="width: 100%">
                  <a-select-option v-for="kind in WIDGET_KINDS" :key="kind" :value="kind">
                    {{ t(`scenarios.widgetKind.${kind}`) }}
                  </a-select-option>
                </a-select>
              </a-col>
              <a-col :span="12">
                <a-select
                  v-if="bindingAliases.length > 0"
                  v-model:value="item.bindingAlias"
                  style="width: 100%"
                  :placeholder="t('scenarios.widgetAliasPlaceholder')"
                >
                  <a-select-option v-for="alias in bindingAliases" :key="alias" :value="alias">
                    {{ alias }}
                  </a-select-option>
                </a-select>
                <a-input
                  v-else
                  v-model:value="item.bindingAlias"
                  :placeholder="t('scenarios.widgetAliasPlaceholder')"
                />
              </a-col>
              <a-col :span="2" style="text-align: center">
                <a-button type="text" danger size="small" @click="removeWidgetRow(idx)">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-col>
            </a-row>
          </div>

          <a-button type="dashed" block style="margin-top: 8px" @click="addWidgetRow">
            <template #icon><PlusOutlined /></template>
            {{ t('scenarios.addWidget') }}
          </a-button>
        </a-form>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.assembly-admin-view {
  display: flex;
  flex-direction: column;
}

.scenarios-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.binding-row {
  margin-bottom: 8px;
  padding: 8px 10px;
  background: var(--od-gray-50, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
}
</style>
