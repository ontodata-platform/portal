<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  algorithmWorkbenchApi,
  type AlgorithmServiceDetail,
  type PreflightResult,
} from '@/api/algorithm-workbench'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import { useMessageStore } from '@/stores/message'
import type { DescriptorInput, MyDelivery } from '@/types/descriptor'

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
    })
    messageStore.success(t('algoWorkbench.submitSuccess', { taskId: receipt.taskId }))
    router.push('/algorithm-workbench?tab=runs')
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="service?.name ?? t('menu.algorithmWorkbench')"
      :description="t('algoWorkbench.runPageDesc')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="wizard-card">
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
          </a-form>
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
                <span class="preflight-label">{{ check.label }}</span>
                <a-tag :color="check.state === 'pass' ? 'success' : 'error'">
                  {{ check.state === 'pass' ? t('algoWorkbench.preflightPass') : t('algoWorkbench.preflightFail') }}
                </a-tag>
                <span class="preflight-hint">{{ check.hint }}</span>
              </div>
              <a-alert
                v-if="!preflight.ok"
                type="error"
                show-icon
                :message="t('algoWorkbench.preflightOkRequired')"
                style="margin-top: 12px"
              />
            </div>
          </a-spin>
          <div class="wizard-actions">
            <a-button @click="step = 0">{{ t('algoWorkbench.wizardPrev') }}</a-button>
            <a-button :loading="preflightLoading" @click="runPreflight">
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
          <a-descriptions :column="1" size="small" bordered class="confirm-table">
            <a-descriptions-item :label="t('common.name')">{{ service?.name }}</a-descriptions-item>
            <a-descriptions-item v-for="input in inputs" :key="input.key" :label="input.label">
              {{ inputValues[input.key] || '—' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('algoWorkbench.wizardTier')">
              {{ tier === 'standard' ? t('algoWorkbench.tierStandard') : t('algoWorkbench.tierLong') }}
            </a-descriptions-item>
          </a-descriptions>
          <div class="wizard-actions">
            <a-button @click="step = 1">{{ t('algoWorkbench.wizardPrev') }}</a-button>
            <a-button type="primary" :loading="submitting" @click="submit">
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.wizard-steps {
  max-width: 560px;
  margin: 0 auto 24px;
}

.wizard-body {
  max-width: 760px;
  margin: 0 auto;
}

.wizard-form {
  max-width: 560px;
}

.wizard-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.preflight {
  display: grid;
  gap: 10px;
}

.preflight-check {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--od-color-line-soft, #e8eef3);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--od-color-paper, #f4f7fb);
}

.preflight-check[data-state='fail'] {
  border-color: color-mix(in srgb, var(--od-color-blocked, #c53030) 30%, transparent);
}

.preflight-label {
  font-weight: 600;
  min-width: 96px;
}

.preflight-hint {
  color: var(--od-color-muted, #52677a);
  font-size: 12px;
}

.confirm-table {
  max-width: 640px;
}
</style>
