import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/new-design-tokens.css'
import './styles/new-element-overrides.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(ElementPlus, { size: 'default' })
app.use(router)
app.mount('#app')
