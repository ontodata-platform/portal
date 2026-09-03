<script setup lang="ts">
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  algorithmWorkbenchApi,
  type AlgorithmServiceDetail,
  type PreflightResult,
} from '@/api/algorithm-workbench'
import { useMessageStore } from '@/stores/message'
import type { DescriptorInput, MyDelivery } from '@/types/descriptor'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const loadError = ref('')
const service = ref<AlgorithmServiceDetail | null>(null)
const inputs = ref<DescriptorInput[]>([])

const step = ref(0)
const submitting = ref(false)

const form = reactive<Record<string, string>>({})
const deliveries = ref<MyDelivery[]>([])

const preflightLoading = ref(false)
const preflight = ref<PreflightResult | null>(null)

const tier = ref<'standard' | 'long'>('standard')

// 输出在线配置（A-7）：与输入一并提交
const outputs = reactive({ name: '', description: '', archiveTier: 'standard' as 'standard' | 'long' })

// 测试数据导入（A-5）：dataset-ref 输入可上传 CSV/JSON 生成临时引用（仅本次运行有效）
const testDataTags = reactive<Record<string, string>>({})
const testDataRefs = ref<string[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const fileTargetKey = ref('')

const inputOptions = (input: DescriptorInput) => {
  if (input.kind === 'dataset-ref') {
    return deliveries.value.map((delivery) => ({
      label: `${delivery.serviceName} · ${delivery.version}（${t('algoWorkbench.wizardSnapshot')} ${delivery.snapshotDate}）`,
      value: `${delivery.serviceCode}@${delivery.version}`,
    }))
  }
  return input.options ?? []
}

function fillDefaults() {
  for (const input of inputs.value) {
    if (form[input.key] === undefined && input.defaultValue !== undefined) {
      form[input.key] = input.defaultValue
    }
  }
}

async function load() {
  if (!code.value) return
  loading.value = true
  loadError.value = ''
  try {
    const [detail, myDeliveries] = await Promise.all([
      algorithmWorkbenchApi.findService(code.value),
      algorithmWorkbenchApi.listMyDeliveries(),
    ])
    service.value = detail
    deliveries.value = myDeliveries
    inputs.value = detail.descriptor.sections.find((section) => section.type === 'inputs')?.inputs ?? []
    outputs.name = `${detail.name}-结果`
    fillDefaults()
  } catch (error) {
    loadError.value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? String(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

const inputValues = computed(() => {
  const values: Record<string, string> = {}
  for (const input of inputs.value) {
    const value = form[input.key]?.trim()
    if (value) values[input.key] = value
  }
  return values
})

const missingRequired = computed(() =>
  inputs.value.filter((input) => input.required && !inputValues.value[input.key]),
)

function pickTestFile(key: string) {
  fileTargetKey.value = key
  fileInputRef.value?.click()
}

async function onTestFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !fileTargetKey.value) return
  try {
    const receipt = await algorithmWorkbenchApi.uploadTestData(file.name)
    form[fileTargetKey.value] = receipt.ref
    testDataTags[fileTargetKey.value] = file.name
    testDataRefs.value = [...testDataRefs.value.filter((item) => !item.startsWith('test:')), receipt.ref]
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    target.value = ''
  }
}

const usedTestDataRefs = computed(() =>
  inputs.value.filter((input) => (form[input.key] ?? '').startsWith('test:')).map((input) => form[input.key]),
)

function nextFromStep1() {
  if (missingRequired.value.length > 0) {
    messageStore.warning(t('algoWorkbench.requiredMissing'))
    return
  }
  step.value = 1
  void runPreflight()
}

async function runPreflight() {
  preflightLoading.value = true
  preflight.value = null
  try {
    preflight.value = await algorithmWorkbenchApi.preflight(code.value, inputValues.value)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    preflightLoading.value = false
  }
}

async function submit() {
  submitting.value = true
  try {
    const receipt = await algorithmWorkbenchApi.submitRun(code.value, {
      inputs: inputValues.value,
      tier: tier.value,
      outputs: {
        name: outputs.name.trim() || `${service.value?.name ?? code.value}-结果`,
        description: outputs.description.trim() || undefined,
        archiveTier: outputs.archiveTier,
      },
      testDataRefs: usedTestDataRefs.value.length > 0 ? usedTestDataRefs.value : undefined,
    })
    messageStore.success(t('algoWorkbench.submitSuccess', { taskId: receipt.taskId }))
    void router.push('/algorithm-workbench?tab=runs')
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="run-wizard-view">
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="service?.name ?? t('menu.algorithmWorkbench')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="wizard-card">
      <template #title>
        <a-space>
          <a-button type="link" @click="router.push('/algorithm-workbench')">
            <template #icon><ArrowLeftOutlined /></template>
            返回算法列表
          </a-button>
          <span class="wizard-title">运行向导: {{ service?.name }}</span>
        </a-space>
      </template>

      <a-spin :spinning="loading">
        <a-steps :current="step" class="wizard-steps" size="small">
          <a-step :title="t('algoWorkbench.wizardStep1')" />
          <a-step :title="t('algoWorkbench.wizardStep2')" />
          <a-step :title="t('algoWorkbench.wizardStep3')" />
        </a-steps>

        <!-- 步骤 1：按描述符 inputs 动态渲染 -->
        <div v-if="step === 0" class="wizard-body">
          <a-form layout="vertical" class="wizard-form">
            <a-form-item
              v-for="input in inputs"
              :key="input.key"
              :label="input.label"
              :required="input.required"
              :extra="input.hint"
            >
              <a-select
                v-if="input.kind === 'dataset-ref'"
                v-model:value="form[input.key]"
                :options="inputOptions(input)"
                :placeholder="t('algoWorkbench.wizardChooseData')"
                allow-clear
                show-search
                option-filter-prop="label"
                style="max-width: 520px"
              />
              <div v-if="input.kind === 'dataset-ref'" class="test-import-row">
                <a-button size="small" @click="pickTestFile(input.key)">
                  {{ t('algoWorkbench.importTestData') }}
                </a-button>
                <a-tag v-if="testDataTags[input.key]" color="orange" class="test-tag">
                  {{ t('algoWorkbench.testDataOnly') }}：{{ testDataTags[input.key] }}
                </a-tag>
              </div>
              <a-select
                v-else-if="input.kind === 'select'"
                v-model:value="form[input.key]"
                :options="inputOptions(input)"
                style="max-width: 360px"
                allow-clear
              />
              <a-input-number
                v-else-if="input.kind === 'number'"
                v-model:value="form[input.key]"
                style="max-width: 240px"
              />
              <a-date-picker
                v-else-if="input.kind === 'date'"
                v-model:value="form[input.key]"
                value-format="YYYY-MM-DD"
                style="max-width: 240px"
              />
              <a-input
                v-else
                v-model:value="form[input.key]"
                style="max-width: 420px"
              />
            </a-form-item>

            <a-divider class="output-divider">{{ t('algoWorkbench.outputsTitle') }}</a-divider>
            <a-form-item :label="t('algoWorkbench.outputName')" :extra="t('algoWorkbench.outputNameHint')">
              <a-input v-model:value="outputs.name" style="max-width: 420px" />
            </a-form-item>
            <a-form-item :label="t('algoWorkbench.outputDesc')">
              <a-textarea v-model:value="outputs.description" :rows="2" style="max-width: 520px" />
            </a-form-item>
            <a-form-item :label="t('algoWorkbench.archiveTier')">
              <a-radio-group v-model:value="outputs.archiveTier">
                <a-radio value="standard">{{ t('algoWorkbench.tierStandard') }}</a-radio>
                <a-radio value="long">{{ t('algoWorkbench.tierLong') }}</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-form>
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv,.json"
            style="display: none"
            @change="onTestFileChange"
          />
          <div class="wizard-actions">
            <a-button @click="router.push('/algorithm-workbench')">{{ t('algoWorkbench.wizardPrev') }}</a-button>
            <a-button type="primary" @click="nextFromStep1">{{ t('algoWorkbench.wizardNext') }}</a-button>
          </div>
        </div>

        <!-- 步骤 2：预检（问题项用人话给原因与修复建议） -->
        <div v-else-if="step === 1" class="wizard-body">
          <a-spin :spinning="preflightLoading">
            <div v-if="preflight" class="preflight">
              <div
                v-for="check in preflight.checks"
                :key="check.label"
                class="preflight-check"
                :data-state="check.state"
              >
                <div class="check-left">
                  <component
                    :is="check.state === 'pass' ? CheckCircleOutlined : CloseCircleOutlined"
                    :class="check.state === 'pass' ? 'icon-pass' : 'icon-fail'"
                  />
                  <span class="preflight-label">{{ check.label }}</span>
                </div>
                <div class="check-right">
                  <a-tag :color="check.state === 'pass' ? 'success' : 'error'">
                    {{ check.state === 'pass' ? t('algoWorkbench.preflightPass') : t('algoWorkbench.preflightFail') }}
                  </a-tag>
                  <span class="preflight-hint">{{ check.hint }}</span>
                </div>
              </div>
              <a-alert
                v-if="!preflight.ok"
                type="error"
                show-icon
                :message="t('algoWorkbench.preflightOkRequired')"
                style="margin-top: 16px; border-radius: 8px"
              />
            </div>
          </a-spin>
          <div class="wizard-actions">
            <a-button @click="step = 0">{{ t('algoWorkbench.wizardPrev') }}</a-button>
            <a-button :loading="preflightLoading" @click="runPreflight">
              <template #icon><ReloadOutlined /></template>
              {{ t('algoWorkbench.preflightRerun') }}
            </a-button>
            <a-button
              type="primary"
              :disabled="!preflight?.ok"
              @click="step = 2"
            >
              {{ t('algoWorkbench.wizardNext') }}
            </a-button>
          </div>
        </div>

        <!-- 步骤 3：确认与提交 -->
        <div v-else class="wizard-body">
          <a-descriptions :column="1" size="middle" bordered class="confirm-table">
            <a-descriptions-item :label="t('common.name')">
              <strong>{{ service?.name }}</strong>
            </a-descriptions-item>
            <a-descriptions-item v-for="input in inputs" :key="input.key" :label="input.label">
              <span class="mono-text">{{ inputValues[input.key] || '—' }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="t('algoWorkbench.wizardTier')">
              <a-tag color="blue">
                {{ tier === 'standard' ? t('algoWorkbench.tierStandard') : t('algoWorkbench.tierLong') }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
          <div class="wizard-actions">
            <a-button @click="step = 1">{{ t('algoWorkbench.wizardPrev') }}</a-button>
            <a-button type="primary" :loading="submitting" @click="submit">
              <template #icon><PlayCircleOutlined /></template>
              {{ t('algoWorkbench.wizardSubmit') }}
            </a-button>
          </div>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<style scoped>
.wizard-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.wizard-title {
  font-size: 16px;
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
}

.wizard-steps {
  max-width: 600px;
  margin: 0 auto 32px;
}

.wizard-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 12px;
}

.wizard-form {
  max-width: 580px;
}

.wizard-actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
}

.preflight {
  display: grid;
  gap: 12px;
}

.preflight-check {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--od-gray-50, #f8fafc);
  transition: all 0.15s ease;
}

.preflight-check[data-state='fail'] {
  border-color: rgba(220, 38, 38, 0.3);
  background: #fffafa;
}

.check-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-pass {
  color: var(--od-color-success, #059669);
  font-size: 16px;
}

.icon-fail {
  color: var(--od-color-blocked, #dc2626);
  font-size: 16px;
}

.preflight-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--od-gray-800, #1e293b);
}

.check-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preflight-hint {
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
}

.confirm-table {
  max-width: 680px;
  border-radius: 8px;
  overflow: hidden;
}

.mono-text {
  font-family: var(--od-font-mono, monospace);
}

.output-divider {
  margin: 8px 0 16px;
}

.test-import-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.test-tag {
  font-size: 12px;
}
</style>
