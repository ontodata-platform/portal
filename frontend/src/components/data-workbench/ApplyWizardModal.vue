<script setup lang="ts">
/**
 * 申请向导（B3）：三步式——① 产品与字段（支持多产品合并申请）
 * ② 申请四要素（使用目的/数据范围/时间范围/交付要求，技术要求 §19）
 * ③ 确认提交（审批人视角预览）。
 * 提交按 target 逐个调用申请接口，回传全部申请单摘要。
 */
import { CheckOutlined } from '@ant-design/icons-vue'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dataWorkbenchApi } from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'
import AttachmentUpload from '@/components/attachment/AttachmentUpload.vue'
import {
  APPLICATION_REGIONS,
  DELIVERY_FORMATS,
  validateUseIntent,
  type ApplicationSummary,
  type ApplicationUseIntent,
  type ApplyTarget,
} from '@/types/application'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ targets: ApplyTarget[] }>()
const emit = defineEmits<{ submitted: [apps: ApplicationSummary[]] }>()

const { t } = useI18n()
const messageStore = useMessageStore()
const identityStore = useIdentityStore()

const applying = ref(false)
const applyStep = ref(0)
const applyForm = reactive({
  purpose: '',
  regions: [] as string[],
  timeFrom: '',
  timeTo: '',
  deliveryFormats: [] as string[],
  deliveryFrequency: 'ONCE' as 'ONCE' | 'PERIODIC',
  deliveryNote: '',
})
/** 每个产品的申请字段（缺省=整条数据）。 */
const targetColumns = reactive<Record<string, string[]>>({})
const columnInputs = reactive<Record<string, string>>({})

const primary = computed(() => props.targets[0])

/** 四要素校验错误：进入确认步骤前必须清零。 */
const useIntentErrors = computed(() => validateUseIntent(useIntentDraft.value))

const useIntentDraft = computed<ApplicationUseIntent>(() => ({
  purpose: applyForm.purpose,
  regions: applyForm.regions,
  timeFrom: applyForm.timeFrom,
  timeTo: applyForm.timeTo,
  deliveryFormats: applyForm.deliveryFormats,
  deliveryFrequency: applyForm.deliveryFrequency,
  deliveryNote: applyForm.deliveryNote || undefined,
}))

watch(open, (value) => {
  if (!value) return
  applyForm.purpose = ''
  applyForm.regions = []
  applyForm.timeFrom = ''
  applyForm.timeTo = ''
  applyForm.deliveryFormats = []
  applyForm.deliveryFrequency = 'ONCE'
  applyForm.deliveryNote = ''
  applyStep.value = 0
  for (const target of props.targets) {
    targetColumns[target.code] = [...(target.fields ?? [])]
    columnInputs[target.code] = ''
  }
}, { immediate: true })

function addColumn(target: ApplyTarget) {
  const col = (columnInputs[target.code] ?? '').trim()
  const columns = targetColumns[target.code] ?? []
  if (col && !columns.includes(col)) {
    targetColumns[target.code] = [...columns, col]
  }
  columnInputs[target.code] = ''
}

function removeColumn(target: ApplyTarget, col: string) {
  targetColumns[target.code] = (targetColumns[target.code] ?? []).filter((item) => item !== col)
}

/** 从要素步骤进入确认前校验；错误就地为提示（inline-validation）。 */
function goToConfirm() {
  if (Object.keys(useIntentErrors.value).length > 0) return
  applyStep.value = 2
}

async function submitApply() {
  if (!primary.value) return
  applying.value = true
  try {
    const summaries: ApplicationSummary[] = []
    for (const target of props.targets) {
      const grantedColumns = targetColumns[target.code]
      const columns = grantedColumns && grantedColumns.length > 0 ? grantedColumns : undefined
      if (target.source === 'DATASET') {
        const created = await dataWorkbenchApi.apply({
          source: 'DATASET',
          serviceCode: target.code,
          serviceName: target.name,
          grantedColumns: columns,
          useIntent: useIntentDraft.value,
        })
        summaries.push({ code: created.code, status: created.status, serviceCode: created.serviceCode, serviceName: created.serviceName })
      } else {
        const res = await marketplaceApi.apply(target.code, { grantedColumns: columns, useIntent: useIntentDraft.value })
        summaries.push({ code: res.approvalCode, status: res.status, serviceCode: target.code, serviceName: target.name })
      }
    }
    messageStore.success(
      summaries.length > 1
        ? t('marketplace.applySuccessBulk', { count: summaries.length, code: summaries[summaries.length - 1].code })
        : t('marketplace.applySuccess', { code: summaries[0].code }),
    )
    open.value = false
    emit('submitted', summaries)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    applying.value = false
  }
}

defineExpose({ submitApply, goToConfirm, applyStep })
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="t('marketplace.applyModal')"
    :confirm-loading="applying"
    width="640px"
  >
    <a-steps :current="applyStep" size="small" class="apply-steps">
      <a-step :title="t('marketplace.applyStepFields')" />
      <a-step :title="t('marketplace.applyStepIntent')" />
      <a-step :title="t('marketplace.applyStepConfirm')" />
    </a-steps>

    <!-- 步骤一：产品与字段（多产品合并申请） -->
    <a-form v-if="applyStep === 0" layout="vertical">
      <a-form-item
        v-for="target in targets"
        :key="target.code"
        :label="target.name"
        :extra="`${t('common.stableCode')}: ${target.code}`"
      >
        <a-input
          v-model:value="columnInputs[target.code]"
          :aria-label="t('marketplace.grantedColumns')"
          :placeholder="t('marketplace.columnInputPlaceholder')"
          @press-enter.prevent="addColumn(target)"
        >
          <template #suffix>
            <a-button type="link" size="small" :disabled="!columnInputs[target.code]?.trim()" @click="addColumn(target)">
              <template #icon><CheckOutlined /></template>
            </a-button>
          </template>
        </a-input>
        <div v-if="(targetColumns[target.code] ?? []).length > 0" style="margin-top: 8px">
          <a-tag
            v-for="col in targetColumns[target.code]"
            :key="col"
            closable
            color="blue"
            @close="removeColumn(target, col)"
          >
            {{ col }}
          </a-tag>
        </div>
      </a-form-item>
    </a-form>

    <!-- 步骤二：申请四要素（技术要求 §19，审批人决策依据） -->
    <a-form v-else-if="applyStep === 1" layout="vertical">
      <a-form-item
        :label="t('marketplace.intentPurpose')"
        required
        :validate-status="useIntentErrors.purpose ? 'error' : ''"
        :help="useIntentErrors.purpose"
      >
        <a-textarea
          v-model:value="applyForm.purpose"
          :placeholder="t('marketplace.intentPurposePlaceholder')"
          :rows="3"
          show-count
          :maxlength="200"
        />
      </a-form-item>
      <a-form-item
        :label="t('marketplace.intentRegions')"
        required
        :validate-status="useIntentErrors.regions ? 'error' : ''"
        :help="useIntentErrors.regions"
      >
        <a-checkbox-group :value="applyForm.regions" class="intent-options" @update:value="applyForm.regions = $event as string[]">
          <a-checkbox v-for="region in APPLICATION_REGIONS" :key="region" :value="region">{{ region }}</a-checkbox>
        </a-checkbox-group>
      </a-form-item>
      <a-form-item
        :label="t('marketplace.intentTimeRange')"
        required
        :validate-status="useIntentErrors.timeRange ? 'error' : ''"
        :help="useIntentErrors.timeRange"
      >
        <div class="intent-time-range">
          <a-date-picker v-model:value="applyForm.timeFrom" value-format="YYYY-MM-DD" :placeholder="t('marketplace.intentTimeFrom')" />
          <span class="intent-time-sep">{{ t('marketplace.intentTimeTo2') }}</span>
          <a-date-picker v-model:value="applyForm.timeTo" value-format="YYYY-MM-DD" :placeholder="t('marketplace.intentTimeTo')" />
        </div>
      </a-form-item>
      <a-form-item :label="t('marketplace.intentDelivery')" required>
        <div class="intent-delivery">
          <a-checkbox-group :value="applyForm.deliveryFormats" class="intent-options" @update:value="applyForm.deliveryFormats = $event as string[]">
            <a-checkbox v-for="format in DELIVERY_FORMATS" :key="format" :value="format">{{ format }}</a-checkbox>
          </a-checkbox-group>
          <a-radio-group v-model:value="applyForm.deliveryFrequency" size="small">
            <a-radio-button value="ONCE">{{ t('marketplace.intentFrequencyOnce') }}</a-radio-button>
            <a-radio-button value="PERIODIC">{{ t('marketplace.intentFrequencyPeriodic') }}</a-radio-button>
          </a-radio-group>
          <a-input v-model:value="applyForm.deliveryNote" :placeholder="t('marketplace.intentDeliveryNote')" />
        </div>
      </a-form-item>
      <a-form-item :label="t('marketplace.intentAttachments')">
        <AttachmentUpload biz-type="application" :biz-code="`draft:${primary?.code ?? 'new'}`" />
      </a-form-item>
    </a-form>

    <!-- 步骤三：审批人视角预览 -->
    <template v-else>
      <p class="preview-hint">{{ t('marketplace.previewHint') }}</p>
      <a-descriptions :column="1" size="small" bordered>
        <a-descriptions-item :label="t('marketplace.previewTargets')">
          {{ targets.map((item) => item.name).join('、') }}
        </a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.previewApplicant')">{{ identityStore.name }}</a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.intentPurpose')">{{ applyForm.purpose }}</a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.intentRegions')">{{ applyForm.regions.join('、') }}</a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.intentTimeRange')">{{ applyForm.timeFrom }} ~ {{ applyForm.timeTo }}</a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.intentDelivery')">
          {{ applyForm.deliveryFormats.join('、') }} · {{ applyForm.deliveryFrequency === 'ONCE' ? t('marketplace.intentFrequencyOnce') : t('marketplace.intentFrequencyPeriodic') }}
        </a-descriptions-item>
        <a-descriptions-item v-if="applyForm.deliveryNote" :label="t('marketplace.intentDeliveryNote')">{{ applyForm.deliveryNote }}</a-descriptions-item>
      </a-descriptions>
    </template>

    <template #footer>
      <a-button :disabled="applying" @click="open = false">{{ t('common.cancel') }}</a-button>
      <a-button v-if="applyStep > 0" :disabled="applying" @click="applyStep -= 1">{{ t('common.prevStep') }}</a-button>
      <a-button
        v-if="applyStep === 0"
        type="primary"
        :disabled="targets.length === 0"
        @click="applyStep = 1"
      >
        {{ t('common.nextStep') }}
      </a-button>
      <a-button
        v-else-if="applyStep === 1"
        type="primary"
        :disabled="Object.keys(useIntentErrors).length > 0"
        :title="Object.keys(useIntentErrors).length > 0 ? t('marketplace.intentIncomplete') : undefined"
        @click="goToConfirm"
      >
        {{ t('common.nextStep') }}
      </a-button>
      <a-button v-else type="primary" :loading="applying" @click="submitApply">
        {{ t('marketplace.submitApply') }}
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.apply-steps {
  max-width: 460px;
  margin: 0 auto 24px;
}

.intent-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.intent-time-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.intent-time-sep {
  color: var(--od-gray-500, #64748b);
}

.intent-delivery {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}
</style>
