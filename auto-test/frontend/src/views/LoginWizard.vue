<template>
  <div class="login-wizard">
    <t-card>
      <template #header>
        <div class="card-header">
          <span>登录配置向导</span>
          <t-button theme="primary" @click="goToAccountList">返回账号管理</t-button>
        </div>
      </template>

      <!-- 步骤条 -->
      <div class="steps-bar">
        <div class="step" :class="{ active: currentStep === 1, done: currentStep > 1 }">
          <div class="step-number">{{ currentStep > 1 ? '✓' : '1' }}</div>
          <div class="step-label">选择登录方式</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 1 }"></div>
        <div class="step" :class="{ active: currentStep === 2, done: currentStep > 2 }">
          <div class="step-number">{{ currentStep > 2 ? '✓' : '2' }}</div>
          <div class="step-label">配置登录参数</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 2 }"></div>
        <div class="step" :class="{ active: currentStep === 3 }">
          <div class="step-number">3</div>
          <div class="step-label">验证并保存</div>
        </div>
      </div>

      <!-- 第一步：选择登录方式 -->
      <div v-if="currentStep === 1" class="step-content">
        <h3>选择登录方式</h3>
        <p class="step-hint">根据目标系统的登录方式选择合适的类型</p>
        <div class="login-type-grid">
          <div v-for="item in loginTypes" :key="item.value"
               class="login-type-card" :class="{ selected: form.loginType === item.value }"
               @click="form.loginType = item.value">
            <div class="type-icon">{{ item.icon }}</div>
            <div class="type-name">{{ item.label }}</div>
            <div class="type-desc">{{ item.desc }}</div>
          </div>
        </div>
        <div class="step-actions">
          <t-button theme="primary" @click="nextStep" :disabled="!form.loginType">下一步 →</t-button>
        </div>
      </div>

      <!-- 第二步：配置登录参数 -->
      <div v-if="currentStep === 2" class="step-content">
        <h3>配置登录参数</h3>

        <!-- HTTP 密码登录配置 -->
        <template v-if="form.loginType === 'HTTP' || form.loginType === 'PASSWORD'">
          <t-form :data="httpConfig" label-width="120px">
            <t-form-item label="登录 URL *" name="loginUrl">
              <t-input v-model="httpConfig.loginUrl" placeholder="https://example.com/api/auth/login" />
            </t-form-item>
            <t-form-item label="请求方式" name="method">
              <t-radio-group v-model="httpConfig.method">
                <t-radio-button value="POST">POST</t-radio-button>
                <t-radio-button value="GET">GET</t-radio-button>
              </t-radio-group>
            </t-form-item>
            <t-form-item label="用户名字段" name="usernameField">
              <t-input v-model="httpConfig.usernameField" placeholder="username" />
            </t-form-item>
            <t-form-item label="密码字段" name="passwordField">
              <t-input v-model="httpConfig.passwordField" placeholder="password" />
            </t-form-item>
            <t-form-item label="Token 字段" name="tokenField">
              <t-input v-model="httpConfig.tokenField" placeholder="token（从响应中提取的字段名）" />
            </t-form-item>
          </t-form>
        </template>

        <!-- Cookie 会话登录配置 -->
        <template v-else-if="form.loginType === 'COOKIE'">
          <t-form :data="cookieConfig" label-width="120px">
            <t-form-item label="登录 URL *" name="loginUrl">
              <t-input v-model="cookieConfig.loginUrl" placeholder="https://example.com/api/auth/login" />
            </t-form-item>
            <t-form-item label="用户名字段" name="usernameField">
              <t-input v-model="cookieConfig.usernameField" placeholder="username" />
            </t-form-item>
            <t-form-item label="密码字段" name="passwordField">
              <t-input v-model="cookieConfig.passwordField" placeholder="password" />
            </t-form-item>
            <t-form-item label="Token 字段" name="tokenField">
              <t-input v-model="cookieConfig.tokenField" placeholder="可选：从响应体提取 token 的字段名" />
            </t-form-item>
            <div class="form-hint">💡 登录成功后系统会自动提取 Set-Cookie 中的会话信息</div>
          </t-form>
        </template>

        <!-- OAuth2 配置 -->
        <template v-else-if="form.loginType === 'OAUTH2_CODE'">
          <t-form :data="oauthConfig" label-width="120px">
            <t-form-item label="Token URL *" name="tokenUrl">
              <t-input v-model="oauthConfig.tokenUrl" placeholder="https://auth.example.com/oauth/token" />
            </t-form-item>
            <t-form-item label="Client ID *" name="clientId">
              <t-input v-model="oauthConfig.clientId" />
            </t-form-item>
            <t-form-item label="Client Secret" name="clientSecret">
              <t-input v-model="oauthConfig.clientSecret" type="password" />
            </t-form-item>
            <t-form-item label="Grant Type" name="grantType">
              <t-select v-model="oauthConfig.grantType">
                <t-option label="client_credentials（客户端模式）" value="client_credentials" />
                <t-option label="authorization_code（授权码模式）" value="authorization_code" />
                <t-option label="password（密码模式）" value="password" />
              </t-select>
            </t-form-item>
            <t-form-item label="Scope" name="scope">
              <t-input v-model="oauthConfig.scope" placeholder="可选" />
            </t-form-item>
          </t-form>
        </template>

        <!-- CAS 配置 -->
        <template v-else-if="form.loginType === 'CAS'">
          <t-form :data="casConfig" label-width="120px">
            <t-form-item label="CAS 服务器 *" name="casServerUrl">
              <t-input v-model="casConfig.casServerUrl" placeholder="https://cas.example.com/cas" />
            </t-form-item>
            <t-form-item label="服务地址 *" name="serviceUrl">
              <t-input v-model="casConfig.serviceUrl" placeholder="https://myapp.example.com/callback" />
            </t-form-item>
          </t-form>
        </template>

        <!-- 浏览器自动登录配置 -->
        <template v-else-if="form.loginType === 'PLAYWRIGHT'">
          <t-form :data="browserConfig" label-width="140px">
            <t-form-item label="登录页面 URL *" name="loginUrl">
              <t-input v-model="browserConfig.loginUrl" placeholder="https://sso.example.com/login" />
            </t-form-item>
            <t-form-item label="用户名选择器 *" name="usernameSelector">
              <t-input v-model="browserConfig.usernameSelector" placeholder="#username" />
            </t-form-item>
            <t-form-item label="密码选择器 *" name="passwordSelector">
              <t-input v-model="browserConfig.passwordSelector" placeholder="#password" />
            </t-form-item>
            <t-form-item label="登录按钮选择器 *" name="submitSelector">
              <t-input v-model="browserConfig.submitSelector" placeholder="#login-btn" />
            </t-form-item>
            <t-form-item label="成功标志选择器" name="successSelector">
              <t-input v-model="browserConfig.successSelector" placeholder=".user-info 或 /dashboard" />
            </t-form-item>
            <t-form-item label="Token 提取方式" name="tokenExtractType">
              <t-select v-model="browserConfig.tokenExtractType">
                <t-option label="从 localStorage 提取" value="localStorage" />
                <t-option label="从 Cookie 提取" value="cookie" />
                <t-option label="从页面元素提取" value="element" />
              </t-select>
            </t-form-item>
            <t-form-item label="Token Key/选择器" name="tokenKey">
              <t-input v-model="browserConfig.tokenKey" :placeholder="browserConfig.tokenExtractType === 'cookie' ? 'SESSION' : browserConfig.tokenExtractType === 'localStorage' ? 'access_token' : '#token-element'" />
            </t-form-item>
          </t-form>
          <div class="form-hint">💡 浏览器登录会启动无头浏览器自动填写表单并提交，适用于有验证码、前端加密等复杂场景</div>
        </template>

        <div class="step-actions">
          <t-button @click="prevStep">← 上一步</t-button>
          <t-button theme="primary" @click="nextStep">下一步 →</t-button>
        </div>
      </div>

      <!-- 第三步：验证并保存 -->
      <div v-if="currentStep === 3" class="step-content">
        <h3>验证登录配置</h3>
        <t-form :data="verifyForm" label-width="100px">
          <t-form-item label="账号名称 *" name="accountName">
            <t-input v-model="verifyForm.accountName" placeholder="如：生产环境管理员" />
          </t-form-item>
          <t-form-item label="用户名 *" name="username">
            <t-input v-model="verifyForm.username" />
          </t-form-item>
          <t-form-item label="密码 *" name="password">
            <t-input v-model="verifyForm.password" type="password" />
          </t-form-item>
        </t-form>

        <div class="test-section">
          <t-button theme="primary" @click="runTest" :loading="testing" :disabled="!verifyForm.username || !verifyForm.password">
            {{ testing ? '测试中...' : '▶ 执行登录测试' }}
          </t-button>

          <div v-if="testResult" class="test-result" :class="{ success: testResult.success, fail: !testResult.success }">
            <div class="result-header">
              <span v-if="testResult.success">✅ 登录测试成功</span>
              <span v-else>❌ 登录测试失败</span>
            </div>
            <div v-if="testResult.message" class="result-message">{{ testResult.message }}</div>
            <div v-if="testResult.token" class="result-token">
              提取到的 Token: {{ testResult.token.substring(0, 50) }}...
            </div>
            <div v-if="testResult.cookies" class="result-cookies">
              提取到 {{ Object.keys(testResult.cookies).length }} 个 Cookie
            </div>
          </div>
        </div>

        <div class="step-actions">
          <t-button @click="prevStep">← 上一步</t-button>
          <t-button theme="primary" @click="saveConfig" :loading="saving" :disabled="!testResult || !testResult.success">
            保存配置
          </t-button>
        </div>
      </div>
    </t-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import api from '../api'

const router = useRouter()
const currentStep = ref(1)
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)

const loginTypes = [
  { value: 'PASSWORD', label: '密码登录', icon: '🔑', desc: '传统用户名密码 HTTP POST 登录' },
  { value: 'COOKIE', label: 'Cookie 会话', icon: '🍪', desc: '登录后靠 Cookie 维持会话' },
  { value: 'OAUTH2_CODE', label: 'OAuth2', icon: '🔗', desc: 'OAuth2 授权码/客户端模式' },
  { value: 'CAS', label: 'CAS 统一认证', icon: '🏢', desc: 'CAS 协议统一认证登录' },
  { value: 'PLAYWRIGHT', label: '浏览器自动登录', icon: '🌐', desc: '启动浏览器自动填写表单登录' }
]

const form = reactive({ loginType: '' })

const httpConfig = reactive({
  loginUrl: '', method: 'POST', usernameField: 'username',
  passwordField: 'password', tokenField: 'token'
})

const cookieConfig = reactive({
  loginUrl: '', usernameField: 'username',
  passwordField: 'password', tokenField: ''
})

const oauthConfig = reactive({
  tokenUrl: '', clientId: '', clientSecret: '',
  grantType: 'client_credentials', scope: ''
})

const casConfig = reactive({ casServerUrl: '', serviceUrl: '' })

const browserConfig = reactive({
  loginUrl: '', usernameSelector: '#username', passwordSelector: '#password',
  submitSelector: '#login-btn', successSelector: '',
  tokenExtractType: 'localStorage', tokenKey: 'access_token'
})

const verifyForm = reactive({ accountName: '', username: '', password: '' })

const buildLoginConfig = () => {
  switch (form.loginType) {
    case 'PASSWORD':
    case 'HTTP':
      return JSON.stringify(httpConfig)
    case 'COOKIE':
      return JSON.stringify(cookieConfig)
    case 'OAUTH2_CODE':
      return JSON.stringify(oauthConfig)
    case 'CAS':
      return JSON.stringify(casConfig)
    case 'PLAYWRIGHT':
      return JSON.stringify({
        ...browserConfig,
        tokenExtractors: [{
          type: browserConfig.tokenExtractType,
          key: browserConfig.tokenKey,
          name: browserConfig.tokenKey,
          selector: browserConfig.tokenKey
        }]
      })
    default:
      return '{}'
  }
}

const nextStep = () => {
  if (currentStep.value < 3) currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 1) currentStep.value--
}

const runTest = async () => {
  testing.value = true
  testResult.value = null
  try {
    const res = await api.post('/account/login-test', {
      loginType: form.loginType,
      loginConfig: buildLoginConfig(),
      username: verifyForm.username,
      password: verifyForm.password
    })
    if (res.code === 200) {
      testResult.value = { success: true, ...res.data }
      MessagePlugin.success('登录测试成功')
    } else {
      testResult.value = { success: false, message: res.message }
    }
  } catch (e) {
    testResult.value = { success: false, message: e.message || '测试请求失败' }
  } finally {
    testing.value = false
  }
}

const saveConfig = async () => {
  if (!verifyForm.accountName.trim()) return MessagePlugin.warning('请输入账号名称')
  saving.value = true
  try {
    const res = await api.post('/account/create', {
      accountCode: 'LOGIN_' + Date.now(),
      accountName: verifyForm.accountName,
      username: verifyForm.username,
      password: verifyForm.password,
      authType: form.loginType,
      authConfig: buildLoginConfig(),
      loginType: form.loginType,
      loginConfig: buildLoginConfig()
    })
    if (res.code === 200) {
      MessagePlugin.success('登录配置保存成功')
      router.push('/account/list')
    } else {
      MessagePlugin.error(res.message)
    }
  } catch (e) {
    MessagePlugin.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const goToAccountList = () => { router.push('/account/list') }
</script>

<style scoped>
.login-wizard { max-width: 800px; margin: 0 auto; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.steps-bar { display: flex; align-items: center; justify-content: center; margin: 20px 0 30px; }
.step { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.step-number { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  border: 2px solid #ddd; color: #999; font-weight: 600; font-size: 14px; transition: all 0.3s; }
.step.active .step-number { border-color: var(--primary); color: #fff; background: var(--primary); }
.step.done .step-number { border-color: #52c41a; color: #fff; background: #52c41a; }
.step-label { font-size: 13px; color: #666; }
.step.active .step-label { color: var(--primary); font-weight: 500; }
.step-line { width: 80px; height: 2px; background: #ddd; margin: 0 10px; margin-bottom: 20px; transition: all 0.3s; }
.step-line.active { background: var(--primary); }
.step-content { padding: 0 20px; }
.step-content h3 { margin: 0 0 8px; font-size: 18px; color: var(--text); }
.step-hint { color: #999; margin-bottom: 20px; font-size: 14px; }
.login-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.login-type-card { border: 2px solid #eee; border-radius: 8px; padding: 16px; cursor: pointer; text-align: center; transition: all 0.2s; }
.login-type-card:hover { border-color: var(--primary); background: rgba(74, 158, 142, 0.05); }
.login-type-card.selected { border-color: var(--primary); background: rgba(74, 158, 142, 0.1); }
.type-icon { font-size: 28px; margin-bottom: 8px; }
.type-name { font-weight: 500; margin-bottom: 4px; }
.type-desc { font-size: 12px; color: #999; }
.step-actions { display: flex; gap: 10px; justify-content: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #eee; }
.form-hint { color: #999; font-size: 12px; margin: -8px 0 16px 120px; }
.test-section { margin: 20px 0; }
.test-result { margin-top: 12px; padding: 12px 16px; border-radius: 6px; }
.test-result.success { background: #f6ffed; border: 1px solid #b7eb8f; }
.test-result.fail { background: #fff2f0; border: 1px solid #ffccc7; }
.result-header { font-weight: 500; margin-bottom: 4px; }
.result-message { color: #666; font-size: 13px; }
.result-token, .result-cookies { color: #999; font-size: 12px; margin-top: 4px; }
</style>
