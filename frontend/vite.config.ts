import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      // 联调目标：管理门户后端（端口 18085），与数据平台前端 5174 / 本体平台前端 5173 并存
      '/api': {
        target: 'http://localhost:18085',
        changeOrigin: true,
      },
      // agent-runtime：文档约定 18086。本机该端口被无关 GSA 占用，开发默认转发 18087。
      // 其他环境：AGENT_PROXY_TARGET=http://localhost:18086
      '/agent': {
        target: process.env.AGENT_PROXY_TARGET || 'http://127.0.0.1:18087',
        changeOrigin: true,
      },
    },
  },
})
