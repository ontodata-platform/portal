<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue'
import { RouterView } from 'vue-router'

import { ontodataTheme } from '@/ui-kit/theme'
</script>

<template>
  <ConfigProvider :theme="ontodataTheme">
    <RouterView />
  </ConfigProvider>
</template>
