<template>
  <div class="login-container login-theme">
    <!-- ════════ 左侧：品牌 + 图解轮播 ════════ -->
    <div class="login-left">
      <!-- 背景动态光斑 -->
      <span class="blob blob-1"></span>
      <span class="blob blob-2"></span>
      <span class="blob blob-3"></span>

      <div class="left-inner">
        <!-- 品牌 -->
        <div class="brand">
          <div class="mark">AT</div>
          <div class="brand-text">
            <h1>接口测试平台</h1>
            <p>API Automation Test Platform</p>
          </div>
        </div>

        <!-- 图解轮播 -->
        <div
          class="showcase"
          @mouseenter="pauseCarousel"
          @mouseleave="resumeCarousel"
        >
          <div class="showcase-frame">
            <transition name="kb-fade" mode="out-in">
              <img
                :key="current"
                :src="banners[current].src"
                class="showcase-img"
                alt="平台能力图解"
              />
            </transition>
            <span class="showcase-tag">{{ banners[current].tag }}</span>
          </div>

          <!-- 文案 -->
          <transition name="kb-fade" mode="out-in">
            <div class="showcase-caption" :key="'cap' + current">
              <h3>{{ banners[current].title }}</h3>
              <p>{{ banners[current].desc }}</p>
            </div>
          </transition>

          <!-- 指示点 -->
          <div class="dots">
            <button
              v-for="(b, i) in banners"
              :key="i"
              class="dot"
              :class="{ active: i === current }"
              :aria-label="'切换到第' + (i + 1) + '张'"
              @click="goTo(i)"
            ></button>
          </div>
        </div>

        <p class="left-foot">让每一次接口变更，都被自动化守护 ✦</p>
      </div>
    </div>

    <!-- ════════ 右侧：登录卡片 ════════ -->
    <div class="login-right">
      <div class="login-card" :class="{ success: loginSuccess }">
        <!-- 成功动效遮罩 -->
        <transition name="pop">
          <div v-if="loginSuccess" class="success-mask">
            <svg class="check" viewBox="0 0 52 52">
              <circle class="check-circle" cx="26" cy="26" r="24" fill="none" />
              <path class="check-path" fill="none" d="M14 27 l8 8 l16 -18" />
            </svg>
            <p>登录成功，正在进入…</p>
          </div>
        </transition>

        <h2>欢迎登录</h2>

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
          <!-- 用户名 -->
          <el-form-item>
            <el-input
              v-model="form.username"
              placeholder="用户名"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <!-- 密码 -->
          <el-form-item>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              prefix-icon="Lock"
              size="large"
              show-password
            />
            <PasswordStrength
              v-if="form.password"
              :password="form.password"
              :show-requirements="false"
            />
          </el-form-item>

          <!-- 验证码 -->
          <el-form-item>
            <div class="captcha-row">
              <el-input
                v-model="form.captcha"
                placeholder="请输入验证码"
                prefix-icon="Picture"
                size="large"
                maxlength="4"
                class="captcha-input"
                @input="form.captcha = form.captcha.toUpperCase()"
              />
              <div
                class="captcha-box"
                :class="{ refreshing: captchaRefreshing }"
                @click="refreshCaptcha"
                title="点击刷新验证码"
              >
                <img v-if="captchaImage" :src="captchaImage" class="captcha-img" alt="验证码" />
                <span v-else class="captcha-loading">加载中…</span>
                <!-- 倒计时环 -->
                <svg class="captcha-ring" viewBox="0 0 44 44">
                  <circle class="ring-bg" cx="22" cy="22" r="20" />
                  <circle
                    class="ring-fg"
                    cx="22"
                    cy="22"
                    r="20"
                    :stroke-dasharray="ringCirc"
                    :stroke-dashoffset="ringOffset"
                  />
                </svg>
                <span class="captcha-count">{{ countdown }}</span>
                <el-icon class="captcha-refresh"><Refresh /></el-icon>
              </div>
            </div>
          </el-form-item>

          <!-- 登录按钮 -->
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              {{ loading ? '登录中…' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-hint">
          <span>默认账号: admin / Admin@123</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection, Refresh } from '@element-plus/icons-vue'
import api from '../api'
import { setToken, setUser } from '../utils/auth'
import PasswordStrength from '../components/PasswordStrength.vue'
import loginBanners from '../config/loginBanners'

const router = useRouter()
const loading = ref(false)
const ssoEnabled = ref(false)
const form = ref({ username: '', password: '', captcha: '' })

/* ── 图解轮播 ── */
const banners = loginBanners
const current = ref(0)
let carouselTimer = null

const goTo = (i) => {
  current.value = i
  restartCarousel()
}
const restartCarousel = () => {
  clearInterval(carouselTimer)
  carouselTimer = setInterval(() => {
    current.value = (current.value + 1) % banners.length
  }, 5000)
}
const pauseCarousel = () => clearInterval(carouselTimer)
const resumeCarousel = () => restartCarousel()

/* ── 验证码：图片 + 倒计时 + 过期自动刷新 ── */
const captchaToken = ref('')
const captchaImage = ref('')
const captchaRefreshing = ref(false)
const expireSeconds = ref(60)
const countdown = ref(60)
let countdownTimer = null

const ringCirc = 2 * Math.PI * 20
const ringOffset = computed(
  () => ringCirc * (1 - countdown.value / expireSeconds.value)
)

const fetchCaptcha = async () => {
  captchaRefreshing.value = true
  try {
    const res = await api.get('/captcha')
    const d = res.data || {}
    captchaToken.value = d.token
    captchaImage.value = d.image
    expireSeconds.value = d.expireSeconds || 60
    countdown.value = expireSeconds.value
    startCountdown()
  } catch (e) {
    ElMessage.error('验证码加载失败，请稍后重试')
  } finally {
    captchaRefreshing.value = false
  }
}

const startCountdown = () => {
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    }
    // 归零即过期，自动刷新一张新验证码
    if (countdown.value <= 0) {
      fetchCaptcha()
    }
  }, 1000)
}

const refreshCaptcha = () => {
  if (captchaRefreshing.value) return
  fetchCaptcha()
}

/* ── 登录 ── */
const loginSuccess = ref(false)

const handleLogin = async () => {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  if (!form.value.captcha) {
    ElMessage.warning('请输入验证码')
    return
  }
  if (!captchaToken.value) {
    ElMessage.warning('验证码已失效，正在刷新')
    fetchCaptcha()
    return
  }
  loading.value = true
  try {
    const res = await api.post('/user/login', {
      username: form.value.username,
      password: form.value.password,
      captcha: form.value.captcha,
      captchaToken: captchaToken.value
    })
    setToken(res.data.token)
    setUser(res.data.user)
    loginSuccess.value = true
    setTimeout(() => {
      ElMessage.success('登录成功')
      router.push('/')
    }, 900)
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '登录失败')
    // 登录失败（含验证码错误）自动换一张新验证码
    fetchCaptcha()
    form.value.captcha = ''
  } finally {
    loading.value = false
  }
}

const ssoLogin = () => {
  window.location.href = '/api/sso/login'
}

/* ── 生命周期 ── */
onMounted(async () => {
  fetchCaptcha()
  restartCarousel()
  try {
    const res = await api.get('/sso/providers')
    ssoEnabled.value = res.data?.enabled || false
  } catch (e) {
    ssoEnabled.value = false
  }
})

onBeforeUnmount(() => {
  clearInterval(carouselTimer)
  clearInterval(countdownTimer)
})
</script>

<style scoped>
.login-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg, #f8f9fa);
}

/* ════════ 左侧 ════════ */
.login-left {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #1f2d3d 0%, #2c3e50 55%, #1a3a34 100%);
  overflow: hidden;
}

.left-inner {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 560px;
  padding: 0 48px;
  animation: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 36px;
}
.brand .mark {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #4a9e8e, #3a8576);
  box-shadow: 0 8px 24px rgba(74, 158, 142, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0.5px;
  animation: floaty 4s ease-in-out infinite;
}
.brand-text h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 4px;
}
.brand-text p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.5px;
}

/* 图解轮播 */
.showcase { margin-bottom: 28px; }
.showcase-frame {
  position: relative;
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  background: #0f1729;
  aspect-ratio: 720 / 460;
}
.showcase-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform-origin: center;
}
.showcase-tag {
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(74, 158, 142, 0.92);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}
.showcase-caption { margin-top: 18px; min-height: 64px; }
.showcase-caption h3 {
  font-size: 19px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #fff;
}
.showcase-caption p {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
}

.dots { display: flex; gap: 8px; margin-top: 16px; }
.dot {
  width: 26px;
  height: 5px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  padding: 0;
  transition: all 0.3s;
}
.dot.active {
  width: 40px;
  background: var(--primary-light, #5db8a7);
}

.left-foot {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 0.5px;
}

/* 背景光斑 */
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  z-index: 1;
}
.blob-1 {
  width: 320px; height: 320px;
  background: #4a9e8e;
  top: -80px; left: -60px;
  animation: drift1 14s ease-in-out infinite;
}
.blob-2 {
  width: 260px; height: 260px;
  background: #2c7a6b;
  bottom: -60px; right: 10%;
  animation: drift2 18s ease-in-out infinite;
}
.blob-3 {
  width: 200px; height: 200px;
  background: #3a8576;
  top: 40%; right: -40px;
  animation: drift1 20s ease-in-out infinite reverse;
}

/* ════════ 右侧 ════════ */
.login-right {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface, #ffffff);
  position: relative;
}
.login-right::before {
  /* 与左侧衔接的柔光 */
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 80px;
  background: linear-gradient(90deg, rgba(31, 45, 61, 0.06), transparent);
  pointer-events: none;
}

.login-card {
  width: 360px;
  padding: 8px 4px;
  position: relative;
  animation: fadeUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
}

.login-card h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text, #2c3e50);
  margin-bottom: 28px;
  text-align: center;
  letter-spacing: -0.3px;
}

.sso-btn,
.login-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  letter-spacing: 2px;
}
.sso-btn { margin-bottom: 16px; }

.login-btn {
  margin-top: 4px;
  background: linear-gradient(135deg, #4a9e8e, #3a8576);
  border: none;
  box-shadow: 0 8px 20px rgba(74, 158, 142, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}
.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 26px rgba(74, 158, 142, 0.42);
}
.login-btn:active { transform: translateY(0); }

.login-hint {
  text-align: center;
  margin-top: 18px;
  color: var(--text-mute, #8494a7);
  font-size: 13px;
}

/* ── 验证码 ── */
.captcha-row {
  display: flex;
  gap: 12px;
  width: 100%;
}
.captcha-input { flex: 1; }
.captcha-box {
  position: relative;
  width: 124px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border-strong, rgba(0, 0, 0, 0.12));
  background: var(--bg, #f8f9fa);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.captcha-box:hover { transform: scale(1.03); }
.captcha-box.refreshing { animation: popIn 0.3s ease; }
.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.captcha-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 12px;
  color: var(--text-mute, #8494a7);
}
.captcha-ring {
  position: absolute;
  top: 2px; right: 2px;
  width: 20px; height: 20px;
  transform: rotate(-90deg);
  pointer-events: none;
}
.ring-bg { fill: none; stroke: rgba(0, 0, 0, 0.08); stroke-width: 3; }
html.dark .ring-bg { stroke: rgba(255, 255, 255, 0.12); }
.ring-fg {
  fill: none;
  stroke: var(--primary, #4a9e8e);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.captcha-count {
  position: absolute;
  top: 4px; right: 4px;
  width: 16px; height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: var(--primary, #4a9e8e);
  pointer-events: none;
}
.captcha-refresh {
  position: absolute;
  bottom: 3px; right: 4px;
  font-size: 13px;
  color: var(--text-mute, #8494a7);
  pointer-events: none;
}

/* ── 成功动效 ── */
.success-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: var(--surface, #fff);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.success-mask p { color: var(--primary, #4a9e8e); font-weight: 600; }
.check { width: 64px; height: 64px; }
.check-circle {
  stroke: var(--primary, #4a9e8e);
  stroke-width: 3;
  stroke-dasharray: 151;
  stroke-dashoffset: 151;
  animation: drawCircle 0.5s ease forwards;
}
.check-path {
  stroke: var(--primary, #4a9e8e);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: drawCheck 0.4s 0.45s ease forwards;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--border-strong, rgba(0, 0, 0, 0.12));
  background: var(--bg, #f8f9fa);
  transition: border-color 0.2s, box-shadow 0.2s;
}
:deep(.el-input__wrapper:hover) {
  border-color: rgba(74, 158, 142, 0.5);
}
:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 3px rgba(74, 158, 142, 0.18);
  border-color: var(--primary, #4a9e8e);
}

/* ════════ 动画 ════════ */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes floaty {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes drift1 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(40px, 30px); }
}
@keyframes drift2 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-30px, -40px); }
}
@keyframes popIn {
  0% { transform: scale(0.92); }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}
@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}

/* 轮播图：缓慢放大（Ken Burns） + 淡入淡出 */
.kb-fade-enter-active { transition: opacity 0.8s ease, transform 8s ease; }
.kb-fade-leave-active { transition: opacity 0.8s ease; }
.kb-fade-enter-from { opacity: 0; transform: scale(1.08); }
.kb-fade-leave-to { opacity: 0; }
.kb-fade-enter-to { transform: scale(1); }

.pop-enter-active { transition: opacity 0.3s ease; }
.pop-leave-active { transition: opacity 0.3s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; }

/* ════════ 暗色模式 ════════ */
html.dark .login-right { background: var(--surface, #232938); }
html.dark .login-card h2 { color: var(--text, #e8edf3); }
html.dark .login-hint { color: var(--text-mute, #7d8694); }
html.dark .captcha-box { background: var(--bg, #1a1f2e); border-color: var(--border-strong, rgba(255,255,255,0.1)); }
html.dark .captcha-count { color: var(--primary-light, #6dc4b4); }
html.dark .captcha-refresh { color: var(--text-mute, #7d8694); }
html.dark :deep(.el-input__wrapper) { background: var(--bg, #1a1f2e); border-color: var(--border-strong, rgba(255,255,255,0.1)); }
html.dark .success-mask { background: var(--surface, #232938); }

/* 窄屏：隐藏左侧，仅保留登录卡片 */
@media (max-width: 880px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>
