import { getCurrentInstance } from '@vue/composition-api'

// Vue 2.6 + @vue/composition-api 兼容层：模拟 Vue Router 4 的 useRoute/useRouter
export function useRoute() {
  const instance = getCurrentInstance()
  if (!instance) throw new Error('useRoute() must be called inside setup()')
  return instance.proxy.$route
}

export function useRouter() {
  const instance = getCurrentInstance()
  if (!instance) throw new Error('useRouter() must be called inside setup()')
  return instance.proxy.$router
}
