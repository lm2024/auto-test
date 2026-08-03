<template>
  <div class="password-strength">
    <div class="strength-bar">
      <div 
        class="strength-fill" 
        :style="{ width: strengthWidth, backgroundColor: strengthColor }"
      ></div>
    </div>
    <div class="strength-text" :style="{ color: strengthColor }">
      {{ strengthText }}
    </div>
    <div class="password-requirements" v-if="showRequirements">
      <div class="requirement" :class="{ 'met': requirements.length }">
        <span class="icon">{{ requirements.length ? '✓' : '✗' }}</span>
        <span>密码长度至少8位</span>
      </div>
      <div class="requirement" :class="{ 'met': requirements.uppercase }">
        <span class="icon">{{ requirements.uppercase ? '✓' : '✗' }}</span>
        <span>包含大写字母</span>
      </div>
      <div class="requirement" :class="{ 'met': requirements.lowercase }">
        <span class="icon">{{ requirements.lowercase ? '✓' : '✗' }}</span>
        <span>包含小写字母</span>
      </div>
      <div class="requirement" :class="{ 'met': requirements.digit }">
        <span class="icon">{{ requirements.digit ? '✓' : '✗' }}</span>
        <span>包含数字</span>
      </div>
      <div class="requirement" :class="{ 'met': requirements.special }">
        <span class="icon">{{ requirements.special ? '✓' : '✗' }}</span>
        <span>包含特殊字符</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  password: {
    type: String,
    default: ''
  },
  showRequirements: {
    type: Boolean,
    default: true
  }
})

const requirements = computed(() => {
  const pwd = props.password
  return {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(pwd)
  }
})

const strengthScore = computed(() => {
  const reqs = requirements.value
  let score = 0
  
  // 长度分数
  if (props.password.length >= 8) score += 20
  if (props.password.length >= 12) score += 10
  if (props.password.length >= 16) score += 5
  
  // 字符类型分数
  if (reqs.uppercase) score += 15
  if (reqs.lowercase) score += 15
  if (reqs.digit) score += 15
  if (reqs.special) score += 20
  
  // 多样性分数
  const uniqueChars = new Set(props.password.split('')).size
  score += Math.min(uniqueChars * 2, 10)
  
  return Math.min(score, 100)
})

const strengthWidth = computed(() => {
  return `${strengthScore.value}%`
})

const strengthColor = computed(() => {
  if (strengthScore.value < 40) return '#ff6b6b'  // 红色 - 弱
  if (strengthScore.value < 70) return '#ffd93d'  // 黄色 - 中
  return '#6bcb77'  // 绿色 - 强
})

const strengthText = computed(() => {
  if (strengthScore.value < 40) return '密码强度：弱'
  if (strengthScore.value < 70) return '密码强度：中'
  return '密码强度：强'
})
</script>

<style scoped>
.password-strength {
  margin-top: 8px;
}

.strength-bar {
  height: 4px;
  background: var(--sb-border, rgba(255, 255, 255, 0.12));
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-text {
  font-size: 12px;
  margin-bottom: 8px;
  font-weight: 500;
}

.password-requirements {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.requirement {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--text-mute, #8b8b8b);
}

.requirement.met {
  color: #6bcb77;
}

.requirement .icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 4px;
  font-size: 10px;
}
</style>