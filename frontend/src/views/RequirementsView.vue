<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { requirementApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { RequirementRequest } from '@/types/portal'

const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<RequirementRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '', keyword: '' })

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({
  requirementType: 'DATA' as 'DATA' | 'ALGORITHM' | 'COMPREHENSIVE',
  title: '',
  description: '',
  requester: '',
})

const assignOpen = ref(false)
const assigning = ref(false)
const assignTarget = ref<RequirementRequest | null>(null)
const assignForm = reactive({ assigneeSystem: 'data-platform', assigneeRef: '' })

const closeOpen = ref(false)
const closing = ref(false)
const closeTarget = ref<RequirementRequest | null>(null)
const closeForm = reactive({ closedNote: '' })

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '类型', dataIndex: 'requirementType', key: 'requirementType' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '提出人', dataIndex: 'requester', key: 'requester' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '分派目标', dataIndex: 'assigneeSystem', key: 'assigneeSystem' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

const statusColor: Record<string, string> = {
  OPEN: 'default',
  ANALYZING: 'processing',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
}

const typeLabel: Record<string, string> = {
  DATA: '数据需求',
  ALGORITHM: '算法需求',
  COMPREHENSIVE: '综合需求',
}

async function load() {
  loading.value = true
  try {
    const page = await requirementApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      type: query.type || undefined,
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

async function create() {
  creating.value = true
  try {
    await requirementApi.create({
      requirementType: createForm.requirementType,
      title: createForm.title,
      description: createForm.description || undefined,
      requester: createForm.requester,
    })
    messageStore.success('需求已登记（同类型同标题的非终态需求会被去重拦截）')
    createOpen.value = false
    createForm.title = ''
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    creating.value = false
  }
}

async function transition(action: () => Promise<unknown>, successText: string) {
  try {
    await action()
    messageStore.success(successText)
    closeOpen.value = false
    assignOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function analyze(record: RequirementRequest) {
  await transition(() => requirementApi.analyze(record.code), `需求 ${record.code} 已进入分析`)
}

async function assign() {
  if (!assignTarget.value) {
    return
  }
  assigning.value = true
  try {
    await requirementApi.assign(assignTarget.value.code, {
      assigneeSystem: assignForm.assigneeSystem,
      assigneeRef: assignForm.assigneeRef || undefined,
    })
    messageStore.success(`需求 ${assignTarget.value.code} 已分派到 ${assignForm.assigneeSystem}`)
    assignOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    assigning.value = false
  }
}

function openAssign(record: RequirementRequest) {
  assignTarget.value = record
  assignForm.assigneeSystem = 'data-platform'
  assignForm.assigneeRef = ''
  assignOpen.value = true
}

function openComplete(record: RequirementRequest) {
  closeTarget.value = record
  closeForm.closedNote = ''
  closeOpen.value = true
}

async function complete() {
  if (!closeTarget.value) {
    return
  }
  closing.value = true
  try {
    await requirementApi.complete(closeTarget.value.code, { closedNote: closeForm.closedNote })
    messageStore.success(`需求 ${closeTarget.value.code} 已完成`)
    closeOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    closing.value = false
  }
}

async function cancel(record: RequirementRequest) {
  await transition(() => requirementApi.cancel(record.code, {}), `需求 ${record.code} 已取消`)
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 150px">
        <a-select-option value="OPEN">待分析</a-select-option>
        <a-select-option value="ANALYZING">分析中</a-select-option>
        <a-select-option value="ASSIGNED">已分派</a-select-option>
        <a-select-option value="IN_PROGRESS">进行中</a-select-option>
        <a-select-option value="COMPLETED">已完成</a-select-option>
        <a-select-option value="CANCELED">已取消</a-select-option>
      </a-select>
      <a-select v-model:value="query.type" placeholder="类型" allow-clear style="width: 150px">
        <a-select-option value="DATA">数据需求</a-select-option>
        <a-select-option value="ALGORITHM">算法需求</a-select-option>
        <a-select-option value="COMPREHENSIVE">综合需求</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" placeholder="按标题搜索" style="width: 180px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        查询
      </a-button>
      <a-button @click="createOpen = true">登记需求</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'requirementType'">
          {{ typeLabel[record.requirementType] ?? record.requirementType }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="record.status === 'OPEN'"
              size="small"
              type="primary"
              @click="analyze(record)"
            >
              分析
            </a-button>
            <a-button
              v-if="record.status === 'ANALYZING'"
              size="small"
              type="primary"
              @click="openAssign(record)"
            >
              分派
            </a-button>
            <a-button
              v-if="record.status === 'ASSIGNED'"
              size="small"
              type="primary"
              @click="transition(() => requirementApi.progress(record.code), `需求 ${record.code} 已进入进行中`)"
            >
              启动
            </a-button>
            <a-button
              v-if="record.status === 'IN_PROGRESS'"
              size="small"
              type="primary"
              @click="openComplete(record)"
            >
              完成
            </a-button>
            <a-button
              v-if="record.status === 'OPEN' || record.status === 'ANALYZING'"
              size="small"
              danger
              @click="cancel(record)"
            >
              取消
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="createOpen" title="登记需求" :confirm-loading="creating" @ok="create">
      <a-form layout="vertical">
        <a-form-item label="需求类型" required>
          <a-radio-group v-model:value="createForm.requirementType">
            <a-radio value="DATA">数据需求</a-radio>
            <a-radio value="ALGORITHM">算法需求</a-radio>
            <a-radio value="COMPREHENSIVE">综合需求</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="标题" required>
          <a-input v-model:value="createForm.title" placeholder="需求标题（同类型同标题去重）" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="createForm.description" placeholder="需求描述（可空）" :rows="3" />
        </a-form-item>
        <a-form-item label="提出人" required>
          <a-input v-model:value="createForm.requester" placeholder="提出人" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="assignOpen" title="分派需求" :confirm-loading="assigning" @ok="assign">
      <a-form layout="vertical">
        <a-form-item label="分派目标（平台内业务软件）" required>
          <a-select v-model:value="assignForm.assigneeSystem">
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
            <a-select-option value="ontology-platform">ontology-platform</a-select-option>
            <a-select-option value="mcp-gateway">mcp-gateway</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="目标软件任务/对象编码">
          <a-input v-model:value="assignForm.assigneeRef" placeholder="引用编码（可空）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="closeOpen" title="完成需求" :confirm-loading="closing" @ok="complete">
      <a-form layout="vertical">
        <a-form-item label="结项说明（必填，闭环证据）" required>
          <a-textarea v-model:value="closeForm.closedNote" placeholder="例如：数据回填完成并验收" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
