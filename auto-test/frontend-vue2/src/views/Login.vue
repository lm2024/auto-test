<template>
  <div class="login-container">
    <div class="login-left">
      <div class="brand">
        <div class="mark">AT</div>
        <h1>接口测试平台</h1>
        <p>API Automation Test Platform</p>
      </div>
    </div>
    <div class="login-right">
      <div class="login-card">
        <h2>登录</h2>

        <t-button
          v-if="ssoEnabled"
          theme="primary"
          size="large"
          class="sso-btn"
          @click="ssoLogin"
        >
          SSO 统一认证登录
        </t-button>

        <t-divider v-if="ssoEnabled">或使用账号密码</t-divider>

        <t-form :model="form" class="login-form" @submit="handleLogin">
          <t-form-item>
            <t-input
              v-model="form.username"
              placeholder="用户名"
              size="large"
              :prefix-icon="userIcon"
            />
          </t-form-item>
          <t-form-item>
            <t-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              size="large"
              :prefix-icon="lockIcon"
            />
          </t-form-item>
          <t-form-item>
            <t-button
              theme="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              登录
            </t-button>
          </t-form-item>
        </t-form>

        <div class="login-hint">
          <span>默认账号: admin / admin123</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api'
import { setToken, setUser } from '../utils/auth'

export default {
  name: 'Login',
  data() {
    return {
      loading: false,
      ssoEnabled: false,
      userIcon: (h) => h('t-icon', { props: { name: 'user' } }),
      lockIcon: (h) => h('t-icon', { props: { name: 'lock-on' } }),
      form: {
        username: '',
        password: ''
      }
    }
  },
  mounted() {
    this.fetchSSOStatus()
  },
  methods: {
    async fetchSSOStatus() {
      try {
        const res = await api.get('/sso/providers')
        this.ssoEnabled = res.data && res.data.enabled ? res.data.enabled : false
      } catch (e) {
        this.ssoEnabled = false
      }
    },
    async handleLogin() {
      if (!this.form.username || !this.form.password) {
        this.$message.warning('请输入用户名和密码')
        return
      }
      this.loading = true
      try {
        const res = await api.post('/user/login', this.form)
        setToken(res.data.token)
        setUser(res.data.user)
        this.$message.success('登录成功')
        this.$router.push('/')
      } catch (e) {
        const message = e.response && e.response.data && e.response.data.message
          ? e.response.data.message
          : '登录失败'
        this.$message.error(message)
      } finally {
        this.loading = false
      }
    },
    ssoLogin() {
      window.location.href = '/api/sso/login'
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  height: 100vh;
  background: var(--sb-bg, #1c1c1c);
}

.login-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sb-text, #ededed);
  background:
    radial-gradient(1200px 600px at 20% 10%, rgba(62, 207, 142, 0.08), transparent 60%),
    var(--sb-bg, #1c1c1c);
  border-right: 1px solid var(--sb-border, rgba(255, 255, 255, 0.08));
}

.brand {
  text-align: center;
  max-width: 420px;
  padding: 24px;
}

.brand .mark {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--sb-green, #3ecf8e);
  box-shadow: 0 8px 24px rgba(62, 207, 142, 0.3);
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #171717;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0.5px;
}

.brand h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: -0.5px;
}

.brand p {
  font-size: 16px;
  color: var(--sb-text-mute, #8b8b8b);
}

.login-right {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sb-surface, #202020);
}

.login-card {
  width: 360px;
  padding: 40px;
}

.login-card h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--sb-text, #ededed);
  margin-bottom: 32px;
  text-align: center;
  letter-spacing: -0.3px;
}

.sso-btn,
.login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 6px;
}

.sso-btn {
  margin-bottom: 16px;
}

.login-hint {
  text-align: center;
  margin-top: 16px;
  color: var(--sb-text-mute, #8b8b8b);
  font-size: 13px;
}

::v-deep .t-input {
  border-radius: 6px;
  background: var(--sb-bg, #1c1c1c);
  border-color: var(--sb-border-strong, rgba(255, 255, 255, 0.14));
}
::v-deep .t-input:hover {
  border-color: rgba(62, 207, 142, 0.5);
}
::v-deep .t-input--focused,
::v-deep .t-input:focus-within {
  border-color: var(--sb-green, #3ecf8e);
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.18);
}
</style>
