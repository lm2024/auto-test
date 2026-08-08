<template>
  <div class="workbench">
    <section class="welcome-band">
      <div>
        <div class="eyebrow">接口测试工作台</div>
        <h1>今天先完成一条可执行的回归链路</h1>
        <p>按步骤完成录制、整理、断言和执行，不需要一次学会所有管理功能。</p>
      </div>
      <t-button theme="primary" size="large" @click="router.push('/chain/list')">
        <template #icon><PlayCircleIcon /></template>开始测试
      </t-button>
    </section>

    <section class="step-section">
      <div class="section-heading">
        <div>
          <h2>测试流程</h2>
          <span>完成一项后再进入下一项</span>
        </div>
        <t-tag theme="primary" variant="light">{{ completedCount }}/{{ steps.length }} 已完成</t-tag>
      </div>
      <div class="step-list">
        <button
          v-for="step in steps"
          :key="step.id"
          class="step-item"
          :class="{ done: step.done, active: step.id === activeStep }"
          @click="goStep(step)"
        >
          <span class="step-number">{{ step.done ? '✓' : step.id }}</span>
          <span class="step-copy">
            <strong>{{ step.title }}</strong>
            <small>{{ step.description }}</small>
          </span>
          <ChevronRightIcon class="step-arrow" />
        </button>
      </div>
    </section>

    <section class="shortcut-section">
      <div class="section-heading">
        <div>
          <h2>常用入口</h2>
          <span>高级管理功能放在系统管理中</span>
        </div>
      </div>
      <div class="shortcut-grid">
        <button v-for="item in shortcuts" :key="item.title" class="shortcut" @click="router.push(item.path)">
          <component :is="item.icon" class="shortcut-icon" />
          <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
          <ChevronRightIcon />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BrowseIcon, ChevronRightIcon, PlayCircleIcon, ViewListIcon } from 'tdesign-icons-vue-next'

const router = useRouter()
const steps = ref([
  { id: 1, title: '准备测试链路', description: '新建链路，或打开已有链路', path: '/chain/list', done: false },
  { id: 2, title: '录制或导入接口', description: '使用插件录制，或导入 cURL / Swagger', path: '/plugin/download', done: false },
  { id: 3, title: '整理接口并编排', description: '删除无关请求，确认执行顺序', path: '/chain/list', done: false },
  { id: 4, title: '补充变量和断言', description: '让测试结果真正可判断', path: '/chain/list', done: false },
  { id: 5, title: '执行一次冒烟测试', description: '先确认链路能跑通，再保存回归', path: '/execute/list', done: false },
  { id: 6, title: '查看失败并保存', description: '确认结果后进入日常回归', path: '/execute/list', done: false }
])
const activeStep = ref(1)
const completedCount = computed(() => steps.value.filter((step) => step.done).length)
const shortcuts = [
  { title: '测试链路', description: '查看和维护已有链路', path: '/chain/list', icon: ViewListIcon },
  { title: '执行记录', description: '查看最近一次测试结果', path: '/execute/list', icon: BrowseIcon },
  { title: '测试账号', description: '准备登录和执行账号', path: '/account/list', icon: BrowseIcon }
]

function goStep(step) {
  activeStep.value = step.id
  router.push(step.path)
}
</script>

<style scoped>
.workbench { min-height: 100%; padding: 32px 40px 48px; background: var(--bg, #f8f9fa); color: var(--text, #2c3e50); }
.welcome-band { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; max-width: 1120px; margin: 0 auto 32px; padding: 30px 34px; background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; }
.eyebrow { color: var(--primary, #4a9e8e); font-size: 12px; font-weight: 700; margin-bottom: 10px; }
h1 { margin: 0; font-size: 28px; line-height: 1.25; }
.welcome-band p { margin-top: 10px; color: var(--text-secondary, #667085); }
.step-section, .shortcut-section { max-width: 1120px; margin: 0 auto 28px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
h2 { font-size: 18px; margin: 0 0 4px; }
.section-heading span { color: var(--text-secondary, #667085); font-size: 12px; }
.step-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.step-item, .shortcut { display: flex; align-items: center; gap: 12px; text-align: left; border: 1px solid var(--border, #e5e7eb); background: var(--surface, #fff); color: inherit; border-radius: 8px; cursor: pointer; transition: border-color .18s, box-shadow .18s; }
.step-item { min-height: 86px; padding: 16px; }
.step-item:hover, .shortcut:hover, .step-item.active { border-color: var(--primary, #4a9e8e); box-shadow: 0 3px 12px rgba(0,0,0,.06); }
.step-item.done { background: var(--success-bg, #f0fdf4); }
.step-number { width: 28px; height: 28px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: #edf2f7; color: #475569; font-weight: 700; }
.done .step-number { background: #16a34a; color: #fff; }
.step-copy, .shortcut span { min-width: 0; flex: 1; }
.step-copy strong, .shortcut strong { display: block; font-size: 14px; }
.step-copy small, .shortcut small { display: block; margin-top: 5px; color: var(--text-secondary, #667085); line-height: 1.4; }
.step-arrow { color: #98a2b3; flex: 0 0 auto; }
.shortcut-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.shortcut { padding: 18px; }
.shortcut-icon { color: var(--primary, #4a9e8e); flex: 0 0 auto; }
@media (max-width: 900px) { .step-list, .shortcut-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .workbench { padding: 20px 16px; } .welcome-band { align-items: flex-start; flex-direction: column; padding: 22px; } h1 { font-size: 23px; } .step-list, .shortcut-grid { grid-template-columns: 1fr; } }
</style>
