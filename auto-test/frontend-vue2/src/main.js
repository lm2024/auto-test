import Vue from 'vue'
import TDesign from 'tdesign-vue'
import 'tdesign-vue/es/style/index.css'
import './styles/design-tokens.css'
import './styles/tdesign-overrides.css'
import App from './App.vue'
import router from './router'

Vue.use(TDesign)

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
