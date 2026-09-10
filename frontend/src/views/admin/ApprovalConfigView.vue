<script setup lang="ts">
/**
 * 审批配置（D1 简化版）：事项类型字典 + 表单字段编辑器 + 流程节点编辑器。
 * 保存写入本地配置（mock 生效：申请创建与办理页按配置渲染）；真实模式契约对齐后端 T1-2。
 */
import { PlusOutlined } from '@ant-design/icons-vue'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadApprovalTypes, saveApprovalTypes, type ApprovalTypeDef } from '@/mocks/approvalConfig'
import { useMessageStore } from '@/stores/message'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const messageStore = useMessageStore()

const types = ref<ApprovalTypeDef[]>(loadApprovalTypes())
const activeCode = ref(types.value[0]?.code ?? '')

const active = reactive({
  get current(): ApprovalTypeDef {
    return types.value.find((item) => item.code === activeCode.value) ?? types.value[0]
  },
})

function selectType(code: string): void {
  activeCode.value = code
}

function addField(): void {
  active.current.formFields.push({ key: `field_${Date.now().toString(36)}`, label: '新字段', type: 'text', required: false })
}

function removeField(index: number): void {
  active.current.formFields.splice(index, 1)
}

function addNode(): void {
  active.current.flow.push({
    order: active.current.flow.length + 1,
    name: `节点 ${active.current.flow.length + 1}`,
    roleCodes: ['approval-approver'],
    slaHours: 24,
  })
}

function removeNode(index: number): void {
  active.current.flow.splice(index, 1)
  active.current.flow.forEach((node, nodeIndex) => {
    node.order = nodeIndex + 1
  })
}

function save(): void {
  saveApprovalTypes(types.value)
  messageStore.success(t('admin.approvalConfig.saved'))
}
</script>

<template>
  <div class="approval-config">
    <aside class="type-list">
      <button
        v-for="item in types"
        :key="item.code"
        type="button"
        class="type-item"
        :class="{ 'type-item--active': item.code === activeCode }"
        @click="selectType(item.code)"
      >
        {{ item.name }}
        <span class="cell-mono type-code">{{ item.code }}</span>
      </button>
    </aside>

    <section class="editor">
      <h2 class="editor-title">{{ active.current?.name }}（v{{ active.current?.version }}）</h2>

      <h3 class="block-title">{{ t('admin.approvalConfig.fieldsTitle') }}</h3>
      <table class="config-table">
        <thead>
          <tr>
            <th>{{ t('admin.approvalConfig.fieldKey') }}</th>
            <th>{{ t('admin.approvalConfig.fieldLabel') }}</th>
            <th>{{ t('admin.approvalConfig.fieldType') }}</th>
            <th>{{ t('admin.approvalConfig.fieldRequired') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(field, index) in active.current?.formFields ?? []" :key="field.key">
            <td><span class="cell-mono">{{ field.key }}</span></td>
            <td><a-input v-model:value="field.label" size="small" /></td>
            <td>
              <a-select v-model:value="field.type" size="small" style="width: 110px" :options="[
                { value: 'text', label: t('admin.approvalConfig.typeText') },
                { value: 'textarea', label: t('admin.approvalConfig.typeTextarea') },
                { value: 'date', label: t('admin.approvalConfig.typeDate') },
                { value: 'number', label: t('admin.approvalConfig.typeNumber') },
              ]" />
            </td>
            <td><a-switch size="small" :checked="field.required" @change="(checked: boolean) => (field.required = checked)" /></td>
            <td><a-button size="small" danger @click="removeField(index)">{{ t('common.delete') }}</a-button></td>
          </tr>
        </tbody>
      </table>
      <a-button size="small" style="margin-top: 8px" @click="addField">
        <template #icon><PlusOutlined /></template>
        {{ t('admin.approvalConfig.addField') }}
      </a-button>

      <h3 class="block-title">{{ t('admin.approvalConfig.flowTitle') }}</h3>
      <div v-for="(node, index) in active.current?.flow ?? []" :key="index" class="flow-node">
        <span class="flow-order">{{ node.order }}</span>
        <a-input v-model:value="node.name" size="small" style="width: 180px" />
        <span class="flow-meta">{{ t('admin.approvalConfig.nodeRoles') }}：{{ node.roleCodes.map((role) => 中文展示(role)).join('、') }}</span>
        <span class="flow-meta">{{ t('admin.approvalConfig.nodeSla') }} {{ node.slaHours }}h</span>
        <a-button size="small" danger @click="removeNode(index)">{{ t('common.delete') }}</a-button>
      </div>
      <a-button size="small" style="margin-top: 8px" @click="addNode">
        <template #icon><PlusOutlined /></template>
        {{ t('admin.approvalConfig.addNode') }}
      </a-button>

      <div class="editor-footer">
        <a-button type="primary" @click="save">{{ t('common.save') }}</a-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.approval-config {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.type-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.type-item--active {
  border-color: var(--od-primary, #2563eb);
  background: #eff6ff;
}

.type-code {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.editor {
  padding: 16px 20px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 12px;
  background: #fff;
}

.editor-title {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
}

.block-title {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.config-table th,
.config-table td {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  padding: 6px 8px;
  text-align: left;
}

.flow-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 13px;
}

.flow-order {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--od-primary, #2563eb);
  color: #fff;
  font-size: 12px;
}

.flow-meta {
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
}

.editor-footer {
  margin-top: 18px;
}
</style>
