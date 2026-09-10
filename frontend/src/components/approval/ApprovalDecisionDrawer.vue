<script setup lang="ts">
/**
 * 审批办理抽屉（C4 组件化）：个人工作台审批签页与管理端审批监管共用。
 * 输入单号即可办理：结论（通过/驳回）+ 意见；决定成功后 emit decided 供父级刷新。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'
import { 中文展示 } from '@/ui-kit/展示文本'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ approvalCode: string }>()
const emit = defineEmits<{ decided: [decision: 'APPROVED' | 'REJECTED'] }>()

const { t } = useI18n()
const messageStore = useMessageStore()

const deciding = ref(false)
const target = ref<ApprovalRequest | null>(null)
const decision = ref<'APPROVED' | 'REJECTED'>('APPROVED')
const decisionNote = ref('')

watch(open, (value) => {
  if (!value) return
  decision.value = 'APPROVED'
  decisionNote.value = ''
  target.value = null
  void approvalApi
    .find(props.approvalCode)
    .then((res) => {
      target.value = res
    })
    .catch((error) => messageStore.reportError(error))
})

async function decide(): Promise<void> {
  if (!target.value) return
  deciding.value = true
  try {
    await approvalApi.decide(target.value.code, {
      decision: decision.value,
      decisionNote: decisionNote.value || undefined,
    })
    messageStore.success(
      decision.value === 'APPROVED'
        ? t('approvals.decidedApproved', { code: target.value.code })
        : t('approvals.decidedRejected', { code: target.value.code }),
    )
    emit('decided', decision.value)
    open.value = false
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    deciding.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :title="t('approvals.decideModal')"
    :confirm-loading="deciding"
    @ok="decide"
  >
    <div v-if="target" class="decide-target-info">
      <div class="target-row">
        <span class="target-label">{{ t('marketplace.applyCodeLabel') }}</span>
        <span class="mono-code">{{ target.code }}</span>
      </div>
      <div class="target-row">
        <span class="target-label">{{ t('marketplace.applyItemLabel') }}</span>
        <span class="target-title">{{ target.title }}</span>
      </div>
      <div class="target-row">
        <span class="target-label">{{ t('common.applicant') }}</span>
        <span>{{ target.requester }}（{{ 中文展示(target.sourceSystem) }}）</span>
      </div>
    </div>

    <a-form layout="vertical" style="margin-top: 16px">
      <a-form-item name="decision" :label="t('approvals.conclusion')" required>
        <a-radio-group v-model:value="decision" button-style="solid">
          <a-radio-button value="APPROVED">{{ t('approvals.decideApprove') }}</a-radio-button>
          <a-radio-button value="REJECTED">{{ t('approvals.decideReject') }}</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item name="decisionNote" :label="t('approvals.decisionNote')">
        <a-textarea v-model:value="decisionNote" :placeholder="t('approvals.decisionNotePlaceholder')" :rows="3" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.decide-target-info {
  display: grid;
  gap: 6px;
}

.target-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.target-label {
  color: var(--od-gray-500, #64748b);
  flex-shrink: 0;
}
</style>
