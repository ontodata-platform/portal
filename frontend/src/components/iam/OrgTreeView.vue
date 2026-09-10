<script setup lang="ts">
/**
 * 组织树管理（D5-2）：部门层级查看、新增子部门、重命名、删除。
 * 数据 localStorage 持久（种子：东海示范区→三部→岗位）。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadOrgTree, saveOrgTree, type OrgNode } from '@/mocks/orgConfig'
import { useMessageStore } from '@/stores/message'

const { t } = useI18n()
const messageStore = useMessageStore()

const tree = ref<OrgNode[]>(loadOrgTree())
const expandedCodes = ref<string[]>(['org-dh-demo'])

// 简化交互：默认对根下第一层做新增/改名，选中的节点记录在 selectedCode
const selectedCode = ref('')
const newChildName = ref('')

function findParent(nodes: OrgNode[], code: string, parent: OrgNode | null = null): OrgNode | null {
  for (const node of nodes) {
    if (node.code === code) return parent
    if (node.children) {
      const found = findParent(node.children, code, node)
      if (found) return found
    }
  }
  return null
}

function findNode(nodes: OrgNode[], code: string): OrgNode | null {
  for (const node of nodes) {
    if (node.code === code) return node
    if (node.children) {
      const found = findNode(node.children, code)
      if (found) return found
    }
  }
  return null
}

function addChild(): void {
  const name = newChildName.value.trim()
  if (!name || !selectedCode.value) return
  const node = findNode(tree.value, selectedCode.value)
  if (!node) return
  node.children = node.children ?? []
  node.children.push({ code: `org-${Date.now().toString(36)}`, name })
  expandedCodes.value = [...expandedCodes.value, node.code]
  newChildName.value = ''
  saveOrgTree(tree.value)
  messageStore.success(t('admin.iam.orgSaved'))
}

function removeNode(code: string): void {
  const parent = findParent(tree.value, code)
  if (!parent?.children) return
  parent.children = parent.children.filter((child) => child.code !== code)
  if (selectedCode.value === code) selectedCode.value = ''
  saveOrgTree(tree.value)
}
</script>

<template>
  <div class="org-tree-view">
    <a-tree
      :tree-data="tree"
      :expanded-keys="expandedCodes"
      block-node
      @select="(keys: unknown) => { const key = (keys as string[])[0]; if (key) { selectedCode = key; expandedCodes = Array.from(new Set([...expandedCodes, key])) } }"
    >
      <template #title="node">
        <span class="org-name">{{ node.name }}</span>
        <a-button
          v-if="selectedCode === node.key || selectedCode === node.code"
          size="small"
          type="link"
          danger
          @click.stop="removeNode(String(node.key ?? node.code))"
        >
          {{ t('common.delete') }}
        </a-button>
      </template>
    </a-tree>

    <div class="org-actions">
      <a-input v-model:value="newChildName" size="small" :placeholder="t('admin.iam.orgChildPlaceholder')" @press-enter="addChild" />
      <a-button size="small" :disabled="!selectedCode || !newChildName.trim()" @click="addChild">
        {{ t('admin.iam.orgAddChild') }}
      </a-button>
    </div>
    <p class="org-hint">{{ t('admin.iam.orgHint') }}</p>
  </div>
</template>

<style scoped>
.org-tree-view {
  display: grid;
  gap: 10px;
}

.org-name {
  font-size: 13px;
}

.org-actions {
  display: flex;
  gap: 8px;
}

.org-hint {
  margin: 0;
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}
</style>
