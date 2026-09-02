<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue'
import { RouterView } from 'vue-router'

import { ontodataTheme } from '@/ui-kit/theme'
</script>

<template>
  <ConfigProvider :theme="ontodataTheme">
    <RouterView v-slot="{ Component }">
      <Transition name="od-page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </ConfigProvider>
</template>

<style>
.od-page-enter-active,
.od-page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.od-page-enter-from,
.od-page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
