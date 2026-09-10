<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dataWorkbenchApi } from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApplicationSummary, ApplyTarget } from '@/types/application'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ targets: ApplyTarget[] }>()
const emit = defineEmits<{ submitted: [app: ApplicationSummary] }>()

const { t } = useI18n()
const messageStore = useMessageStore()

const applying = ref(false)
const applyStep = ref(0)
const applyForm = reactive({
  grantedColumns: [] as string[],
  columnInput: '',
})

const primary = computed(() => props.targets[0])

watch(open, (value) => {
  if (!value) return
  applyForm.grantedColumns = [...(primary.value?.fields ?? [])]
  applyForm.columnInput = ''
  applyStep.value = 0
}, { immediate: true })

function addColumn() {
  const col = applyForm.columnInput.trim()
  if (col && !applyForm.grantedColumns.includes(col)) {
    applyForm.grantedColumns.push(col)
    applyForm.columnInput = ''
  }
}

function removeColumn(col: string) {
  applyForm.grantedColumns = applyForm.grantedColumns.filter((item) => item !== col)
}

async function submitApply() {
  if (!primary.value) return
  applying.value = true
  try {
    const columns = applyForm.grantedColumns.length > 0 ? applyForm.grantedColumns : undefined
    if (primary.value.source === 'DATASET') {
      const created = await dataWorkbenchApi.apply({
        source: 'DATASET',
        serviceCode: primary.value.code,
        serviceName: primary.value.name,
        grantedColumns: columns,
      })
      const summary: ApplicationSummary = {
        code: created.code,
        status: created.status,
        serviceCode: created.serviceCode,
        serviceName: created.serviceName,
      }
      messageStore.success(t('marketplace.applySuccess', { code: created.code }))
      open.value = false
      emit('submitted', summary)
      return
    }
    const res = await marketplaceApi.apply(primary.value.code, { grantedColumns: columns })
    const summary: ApplicationSummary = {
      code: res.approvalCode,
      status: res.status,
      serviceCode: primary.value.code,
      serviceName: primary.value.name,
    }
    messageStore.success(t('marketplace.applySuccess', { code: res.approvalCode }))
    open.value = false
    emit('submitted', summary)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    applying.value = false
  }
}

defineExpose({ submitApply })
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="t('marketplace.applyModal')"
    :confirm-loading="applying"
    width="560px"
  >
    <a-steps :current="applyStep" size="small" class="apply-steps">
      <a-step :title="t('marketplace.applyStepFields')" />
      <a-step :title="t('marketplace.applyStepConfirm')" />
    </a-steps>
    <a-form layout="vertical">
      <template v-if="applyStep === 0">
        <a-form-item name="serviceName" :label="t('common.name')">
          <a-input :value="primary?.name" disabled />
        </a-form-item>
        <a-form-item name="serviceCode" :label="t('common.stableCode')">
          <a-input :value="primary?.code" disabled />
        </a-form-item>
        <a-form-item
          name="grantedColumns"
          :label="t('marketplace.grantedColumns')"
          :extra="t('marketplace.grantedColumnsPlaceholder')"
        >
          <a-input
            v-model:value="applyForm.columnInput"
            :aria-label="t('marketplace.grantedColumns')"
            :placeholder="t('marketplace.columnInputPlaceholder')"
            @press-enter.prevent="addColumn"
          >
            <template #suffix>
              <a-button type="link" size="small" :disabled="!applyForm.columnInput.trim()" @click="addColumn">
                <template #icon><CheckOutlined /></template>
              </a-button>
            </template>
          </a-input>

          <div v-if="applyForm.grantedColumns.length > 0" style="margin-top: 8px">
            <a-tag
              v-for="col in applyForm.grantedColumns"
              :key="col"
              closable
              color="blue"
              @close="removeColumn(col)"
            >
              {{ col }}
            </a-tag>
          </div>
        </a-form-item>
      </template>
      <a-descriptions v-else :column="1" size="small" bordered>
        <a-descriptions-item :label="t('common.name')">{{ primary?.name }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.stableCode')"><span class="cell-mono">{{ primary?.code }}</span></a-descriptions-item>
        <a-descriptions-item :label="t('marketplace.grantedColumns')">
          {{ applyForm.grantedColumns.join('、') || t('marketplace.applyDefaultFields') }}
        </a-descriptions-item>
        <a-descriptions-item v-if="primary?.applyRequirements?.length" :label="t('marketplace.sectionRequirements')">
          {{ primary.applyRequirements.join('；') }}
        </a-descriptions-item>
      </a-descriptions>
    </a-form>
    <template #footer>
      <a-button :disabled="applying" @click="open = false">{{ t('common.cancel') }}</a-button>
      <a-button v-if="applyStep === 0" type="primary" @click="applyStep = 1">{{ t('common.nextStep') }}</a-button>
      <a-button v-else @click="applyStep = 0">{{ t('common.prevStep') }}</a-button>
      <a-button v-if="applyStep === 1" type="primary" :loading="applying" @click="submitApply">
        {{ t('marketplace.submitApply') }}
      </a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.apply-steps {
  max-width: 420px;
  margin: 0 auto 24px;
}
</style>
