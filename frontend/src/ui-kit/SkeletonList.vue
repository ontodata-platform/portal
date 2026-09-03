<script setup lang="ts">
defineProps<{ rows?: number; variant?: 'list' | 'cards' | 'chat' }>()
</script>

<template>
  <div class="skel" :class="variant || 'list'">
    <div v-for="n in rows ?? 3" :key="n" class="bar"></div>
  </div>
</template>

<style scoped>
.skel { display: grid; gap: 10px; }
.bar {
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(90deg, #eef4fa 25%, #f8fafc 37%, #eef4fa 63%);
  background-size: 400% 100%;
  animation: shine 1.2s ease infinite;
}
.cards { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.cards .bar { height: 88px; }
.chat .bar:first-child { width: 40%; margin-left: auto; }
@keyframes shine {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
</style>
