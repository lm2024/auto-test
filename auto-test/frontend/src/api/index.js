import axios from 'axios'
import { getToken, removeToken } from '../utils/auth'
import router from '../router'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      removeToken()
      router.push('/login')
    }
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default api
