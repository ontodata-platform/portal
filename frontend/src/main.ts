import { createPinia } from 'pinia'
import { createApp } from 'vue'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import App from './App.vue'
import { i18n } from './i18n'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)
app.use(Antd)
app.mount('#app')
