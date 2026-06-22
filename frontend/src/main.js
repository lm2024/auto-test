import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import App from './App.vue'
import router from './router'

Vue.use(VueCompositionAPI)
Vue.use(ElementUI, { size: 'default' })

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
