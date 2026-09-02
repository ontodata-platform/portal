<script setup lang="ts">
import type { AssistantCard } from '@/types/assistant'
import AlgorithmCard from './cards/AlgorithmCard.vue'
import DataServiceCard from './cards/DataServiceCard.vue'
import GuideCard from './cards/GuideCard.vue'
import TaskSummaryCard from './cards/TaskSummaryCard.vue'

defineProps<{ cards: AssistantCard[] }>()
</script>

<template>
  <div class="card-group">
    <template v-for="(card, index) in cards" :key="index">
      <DataServiceCard v-if="card.type === 'data-service'" :payload="card.payload" />
      <AlgorithmCard v-else-if="card.type === 'algorithm'" :payload="card.payload" />
      <TaskSummaryCard v-else-if="card.type === 'task-summary'" :payload="card.payload" />
      <GuideCard v-else-if="card.type === 'guide'" :payload="card.payload" />
    </template>
  </div>
</template>

<style scoped>
.card-group {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
</style>
