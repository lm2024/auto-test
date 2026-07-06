<template>
  <div class="login-container">
    <div class="login-left">
      <div class="brand">
        <h1>接口测试平台</h1>
        <p>API Automation Test Platform</p>
      </div>
    </div>
    <div class="login-right">
      <div class="login-card">
        <h2>登录</h2>

        <el-button
          v-if="ssoEnabled"
          type="primary"
          size="large"
          class="sso-btn"
          @click="ssoLogin"
        >
          <el-icon><Connection /></el-icon>
          SSO 统一认证登录
        </el-button>

        <el-divider v-if="ssoEnabled">或使用账号密码</el-divider>

        <el-form :model="form" @keyup.enter="handleLogin" label-width="0">
          <el-form-item>
            <el-input
              v-model="form.username"
              placeholder="用户名"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              登录
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-hint">
          <span>默认账号: admin / admin123</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'
import api from '../api'
import { setToken, setUser } from '../utils/auth'

const router = useRouter()
const loading = ref(false)
const ssoEnabled = ref(false)
const form = ref({ username: '', password: '' })

onMounted(async () => {
  try {
    const res = await api.get('/sso/providers')
    ssoEnabled.value = res.data?.enabled || false
  } catch (e) {
    ssoEnabled.value = false
  }
})

const handleLogin = async () => {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await api.post('/user/login', form.value)
    setToken(res.data.token)
    setUser(res.data.user)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

const ssoLogin = () => {
  window.location.href = '/api/sso/login'
}
</script>

<style scoped>
.login-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.brand h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 12px;
}

.brand p {
  font-size: 16px;
  opacity: 0.8;
}

.login-right {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
}

.login-card {
  width: 360px;
  padding: 40px;
}

.login-card h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e1b4b;
  margin-bottom: 32px;
  text-align: center;
}

.sso-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  margin-bottom: 16px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
}

.login-hint {
  text-align: center;
  margin-top: 16px;
  color: #9ca3af;
  font-size: 13px;
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
  box-shadow: none;
  border: 1px solid #d0d5dd;
}

:deep(.el-input__wrapper:hover) {
  border-color: #a5b4fc;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}
</style>
