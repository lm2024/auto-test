<template>
  <main class="workbench">
    <header class="workbench-head">
      <div>
        <p class="eyebrow">接口测试平台</p>
        <h1>接口测试工作台</h1>
        <p class="head-desc">从当前待办开始，把一条链路跑通，再逐步沉淀成稳定回归。</p>
      </div>
      <div class="head-actions">
        <span class="updated-at">{{ data.lastUpdated ? `更新于 ${data.lastUpdated}` : '正在读取工作状态' }}</span>
        <t-button variant="outline" :loading="data.loading" @click="loadDashboard">
          <template #icon><RefreshIcon /></template>刷新状态
        </t-button>
      </div>
    </header>

    <section class="focus-panel">
      <div class="focus-copy">
        <span class="section-kicker">现在继续</span>
        <h2>{{ nextAction.title }}</h2>
        <p>{{ nextAction.description }}</p>
        <t-button theme="primary" size="large" @click="runNextAction">
          <template #icon><component :is="nextAction.icon" /></template>{{ nextAction.label }}
        </t-button>
      </div>
      <div class="focus-state">
        <div class="state-label">回归准备度</div>
        <div class="progress-line"><span :style="{ width: `${readiness}%` }"></span></div>
        <strong>{{ readiness }}%</strong>
        <small>{{ readinessText }}</small>
      </div>
    </section>

    <section class="metric-grid" aria-label="测试资产概览">
      <button class="metric-card" @click="router.push('/chain/list')"><span>测试链路</span><strong>{{ data.chainTotal }}</strong><small>{{ emptyText(data.chainTotal, '还没有链路') }}</small><ChevronRightIcon /></button>
      <button class="metric-card" @click="router.push('/account/list')"><span>测试账号</span><strong>{{ data.accountTotal }}</strong><small>{{ emptyText(data.accountTotal, '需要准备执行账号') }}</small><ChevronRightIcon /></button>
      <button class="metric-card" @click="router.push('/execute/list')"><span>执行记录</span><strong>{{ data.executeTotal }}</strong><small>{{ latestExecutionText }}</small><ChevronRightIcon /></button>
      <button class="metric-card" @click="router.push('/scheduled-task')"><span>定时任务</span><strong>{{ data.taskTotal }}</strong><small>{{ data.taskTotal ? '持续回归已配置' : '可选：配置自动回归' }}</small><ChevronRightIcon /></button>
    </section>

    <section class="content-grid">
      <div class="panel todo-panel">
        <div class="panel-head">
          <div><h2>待办任务</h2><p>只显示会影响下一次回归的事项</p></div>
          <t-tag :theme="todoItems.length ? 'warning' : 'success'" variant="light">{{ todoItems.length }} 项待处理</t-tag>
        </div>
        <div v-if="todoItems.length" class="todo-list">
          <button v-for="item in todoItems" :key="item.id" class="todo-item" @click="router.push(item.path)">
            <span class="todo-icon" :class="item.level"><component :is="item.icon" /></span>
            <span class="todo-copy"><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
            <span class="todo-action">{{ item.action }}<ChevronRightIcon /></span>
          </button>
        </div>
        <div v-else class="clear-state"><span class="clear-icon">✓</span><strong>当前没有阻塞事项</strong><p>可以执行一次回归，或把链路交给定时任务。</p></div>
      </div>

      <div class="panel recent-panel">
        <div class="panel-head"><div><h2>最近执行</h2><p>优先处理最近失败的链路</p></div><t-button variant="text" theme="primary" @click="router.push('/execute/list')">查看全部</t-button></div>
        <div v-if="data.executions.length" class="execution-list">
          <button v-for="record in data.executions" :key="record.executionId" class="execution-item" @click="router.push('/execute/detail/' + record.executionId)">
            <span class="status-dot" :class="statusClass(record.status)"></span>
            <span class="execution-copy"><strong>{{ record.chainName || record.chainCode || '未命名链路' }}</strong><small>{{ formatTime(record.startTime) }} · {{ record.successCount || 0 }} 成功 / {{ record.failCount || 0 }} 失败</small></span>
            <t-tag size="small" :theme="statusTheme(record.status)" variant="light">{{ statusText(record.status) }}</t-tag>
          </button>
        </div>
        <div v-else class="empty-inline"><PlayCircleIcon /><span>还没有执行记录，先跑一次冒烟测试。</span><t-button size="small" theme="primary" @click="router.push('/chain/list')">去执行</t-button></div>
      </div>
    </section>

    <section class="journey-panel panel">
      <div class="panel-head"><div><h2>回归准备进度</h2><p>根据真实数据判断，不要求一次完成所有高级配置</p></div><span class="journey-count">{{ completedSteps }}/{{ steps.length }} 已完成</span></div>
      <div class="journey-list">
        <button v-for="step in steps" :key="step.id" class="journey-item" :class="{ done: step.done }" @click="router.push(step.path)">
          <span class="journey-number">{{ step.done ? '✓' : step.id }}</span>
          <span><strong>{{ step.title }}</strong><small>{{ step.description }}</small></span>
          <ChevronRightIcon />
        </button>
      </div>
    </section>

    <section class="quick-section">
      <div class="panel-head"><div><h2>常用操作</h2><p>把高频动作放在手边，其余管理功能在左侧导航中</p></div></div>
      <div class="quick-grid">
        <button v-for="item in quickActions" :key="item.title" class="quick-item" @click="router.push(item.path)">
          <component :is="item.icon" /><span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span><ChevronRightIcon />
        </button>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AddIcon, BrowseIcon, ChevronRightIcon, PlayCircleIcon, RefreshIcon, ViewListIcon } from 'tdesign-icons-vue-next'
import api from '../api'

const router = useRouter()
const data = reactive({ loading: false, lastUpdated: '', chainTotal: 0, chains: [], accountTotal: 0, executeTotal: 0, executions: [], taskTotal: 0 })

const safeList = async (path, params) => {
  try {
    const res = await api.get(path, { params })
    return res.code === 200 ? res.data || {} : {}
  } catch (error) {
    return {}
  }
}

const loadDashboard = async () => {
  data.loading = true
  const [chains, accounts, executions, tasks] = await Promise.all([
    safeList('/chain/list', { pageNo: 1, pageSize: 5 }),
    safeList('/account/list', { pageNo: 1, pageSize: 1 }),
    safeList('/execute/list', { pageNo: 1, pageSize: 5 }),
    safeList('/task/list', { pageNo: 1, pageSize: 1 })
  ])
  data.chainTotal = chains.total || 0
  data.chains = chains.list || []
  data.accountTotal = accounts.total || 0
  data.executeTotal = executions.total || 0
  data.executions = executions.list || []
  data.taskTotal = tasks.total || 0
  data.lastUpdated = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  data.loading = false
}

const latestExecution = computed(() => data.executions[0] || null)
const hasConfiguredChain = computed(() => data.chains.some(chain => Number(chain.nodeCount || 0) > 0))
const hasFailedExecution = computed(() => data.executions.some(record => record.status === 'FAILED'))
const readiness = computed(() => {
  const values = [data.chainTotal > 0, hasConfiguredChain.value, data.accountTotal > 0, data.executeTotal > 0, latestExecution.value?.status === 'SUCCESS']
  return Math.round(values.filter(Boolean).length / values.length * 100)
})
const readinessText = computed(() => readiness.value >= 80 ? '已经具备日常回归条件' : readiness.value >= 40 ? '还有关键准备项' : '从创建第一条链路开始')
const completedSteps = computed(() => steps.value.filter(step => step.done).length)
const steps = computed(() => [
  { id: 1, title: '建立测试链路', description: data.chainTotal ? `已有 ${data.chainTotal} 条链路` : '创建第一条链路', path: '/chain/list', done: data.chainTotal > 0 },
  { id: 2, title: '录入并整理接口', description: hasConfiguredChain.value ? '至少一条链路已有接口' : '录制、导入或补充接口', path: '/chain/list', done: hasConfiguredChain.value },
  { id: 3, title: '准备执行账号', description: data.accountTotal ? `已有 ${data.accountTotal} 个账号` : '登录配置和执行账号', path: '/account/list', done: data.accountTotal > 0 },
  { id: 4, title: '完成一次冒烟执行', description: latestExecution.value?.status === 'SUCCESS' ? '最近一次执行成功' : '验证链路是否可运行', path: '/execute/list', done: latestExecution.value?.status === 'SUCCESS' }
])
const todoItems = computed(() => {
  const items = []
  if (!data.chainTotal) items.push({ id: 'chain', level: 'urgent', title: '创建第一条测试链路', description: '没有链路就无法录入接口和执行回归。', action: '去创建', path: '/chain/list', icon: AddIcon })
  else if (!hasConfiguredChain.value) items.push({ id: 'nodes', level: 'urgent', title: '整理链路接口', description: '当前链路还没有可执行接口，请先录制或导入。', action: '去整理', path: '/chain/list', icon: ViewListIcon })
  if (!data.accountTotal) items.push({ id: 'account', level: 'urgent', title: '准备执行账号', description: '为需要登录的目标系统配置账号。', action: '去配置', path: '/account/list', icon: AddIcon })
  if (!data.executeTotal && hasConfiguredChain.value) items.push({ id: 'execute', level: 'urgent', title: '执行一次冒烟测试', description: '先确认链路能跑通，再沉淀为回归任务。', action: '去执行', path: '/chain/list', icon: PlayCircleIcon })
  if (hasFailedExecution.value) items.push({ id: 'failure', level: 'warning', title: '处理失败执行记录', description: '最近执行中存在失败结果，建议先查看节点详情。', action: '看失败', path: '/execute/list', icon: BrowseIcon })
  if (!data.taskTotal && data.executeTotal) items.push({ id: 'schedule', level: 'normal', title: '配置定时回归', description: '可选：让稳定链路按计划自动运行。', action: '去设置', path: '/scheduled-task', icon: RefreshIcon })
  return items.slice(0, 5)
})
const nextAction = computed(() => todoItems.value[0] || { title: '开始下一次回归', description: '当前没有阻塞事项，可以选择一条链路执行验证。', label: '查看测试链路', path: '/chain/list', icon: PlayCircleIcon })
const latestExecutionText = computed(() => latestExecution.value ? `最近：${statusText(latestExecution.value.status)}` : '还没有执行记录')
const quickActions = [
  { title: '新建测试链路', description: '从空白链路开始编排', path: '/chain/list', icon: AddIcon },
  { title: '录制或导入接口', description: '使用插件或导入工具', path: '/plugin/download', icon: BrowseIcon },
  { title: '准备测试账号', description: '配置登录与执行凭证', path: '/account/list', icon: ViewListIcon },
  { title: '查看执行记录', description: '定位最近失败节点', path: '/execute/list', icon: PlayCircleIcon }
]

function runNextAction() { router.push(nextAction.value.path) }
function emptyText(value, text) { return value ? '已有资产，可继续维护' : text }
function formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未知' }
function statusText(status) { return ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' }[status] || status || '未知') }
function statusTheme(status) { return ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger' }[status] || 'default') }
function statusClass(status) { return status ? status.toLowerCase() : 'unknown' }

onMounted(loadDashboard)
</script>

<style scoped>
.workbench { min-height: 100%; padding: 28px 40px 48px; background: var(--bg); color: var(--text); }
.workbench-head, .focus-panel, .metric-grid, .content-grid, .journey-panel, .quick-section { max-width: 1180px; margin-left: auto; margin-right: auto; }
.workbench-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
.eyebrow, .section-kicker { margin: 0 0 6px; color: var(--primary); font-size: 12px; font-weight: 700; letter-spacing: .04em; }
h1 { margin: 0; font-size: 28px; line-height: 36px; }
.head-desc { margin: 6px 0 0; color: var(--text-secondary); font-size: 14px; }
.head-actions { display: flex; align-items: center; gap: 12px; }
.updated-at { color: var(--text-mute); font-size: 12px; white-space: nowrap; }
.focus-panel, .panel, .metric-card { border: 1px solid var(--border-strong); border-radius: var(--radius-md); background: var(--surface); }
.focus-panel { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(240px, .7fr); gap: 32px; align-items: center; padding: 24px 28px; }
.focus-copy h2 { margin: 0 0 6px; font-size: 22px; }
.focus-copy p { margin: 0 0 18px; color: var(--text-secondary); font-size: 14px; }
.focus-state { padding-left: 28px; border-left: 1px solid var(--border-subtle); }
.state-label { margin-bottom: 12px; color: var(--text-secondary); font-size: 13px; }
.progress-line { height: 8px; overflow: hidden; border-radius: 99px; background: var(--surface-2); }
.progress-line span { display: block; height: 100%; border-radius: inherit; background: var(--primary); transition: width .3s ease; }
.focus-state strong { display: block; margin-top: 10px; font-size: 30px; line-height: 34px; }
.focus-state small { color: var(--text-secondary); font-size: 12px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
.metric-card { position: relative; padding: 16px; text-align: left; color: inherit; cursor: pointer; transition: border-color .18s, transform .18s; }
.metric-card:hover { border-color: var(--primary); background: var(--accent-bg); transform: translateY(-1px); }
.metric-card span, .metric-card small { display: block; color: var(--text-mute); font-size: 12px; }
.metric-card strong { display: block; margin: 8px 0 4px; font-size: 26px; line-height: 32px; }
.metric-card svg { position: absolute; top: 18px; right: 16px; color: var(--text-mute); }
.content-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 16px; margin-top: 16px; }
.panel { padding: 18px; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.panel-head h2 { margin: 0; font-size: 16px; }
.panel-head p { margin: 4px 0 0; color: var(--text-mute); font-size: 12px; }
.todo-list, .execution-list { display: grid; gap: 8px; }
.todo-item, .execution-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface); color: inherit; text-align: left; cursor: pointer; }
.todo-item:hover, .execution-item:hover, .journey-item:hover, .quick-item:hover { border-color: var(--primary); background: var(--accent-bg); }
.todo-icon { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border-radius: 50%; background: var(--surface-2); color: var(--text-secondary); }
.todo-icon.urgent { background: var(--danger-bg); color: var(--danger); }.todo-icon.warning { background: var(--warning-bg); color: var(--warning); }
.todo-copy, .execution-copy { min-width: 0; flex: 1; }.todo-copy strong, .execution-copy strong { display: block; overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }.todo-copy small, .execution-copy small { display: block; overflow: hidden; margin-top: 4px; color: var(--text-mute); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.todo-action { display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; color: var(--primary); font-size: 12px; }
.clear-state { padding: 32px 12px; text-align: center; }.clear-icon { display: grid; place-items: center; width: 34px; height: 34px; margin: 0 auto 10px; border-radius: 50%; background: var(--success-bg); color: var(--success); font-weight: 700; }.clear-state strong { font-size: 14px; }.clear-state p { margin: 6px 0 0; color: var(--text-mute); font-size: 12px; }
.status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--text-mute); }.status-dot.success { background: var(--success); }.status-dot.failed { background: var(--danger); }.status-dot.running { background: var(--warning); }
.empty-inline { display: flex; align-items: center; gap: 8px; min-height: 132px; color: var(--text-mute); font-size: 13px; }
.journey-panel { margin-top: 16px; }.journey-count { color: var(--primary); font-size: 12px; font-weight: 600; }
.journey-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }.journey-item, .quick-item { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface); color: inherit; text-align: left; cursor: pointer; }.journey-item > span:nth-child(2), .quick-item span { min-width: 0; flex: 1; }.journey-number { display: grid; place-items: center; width: 26px; height: 26px; flex: 0 0 auto; border-radius: 50%; background: var(--surface-2); color: var(--text-secondary); font-size: 12px; font-weight: 700; }.journey-item.done .journey-number { background: var(--success); color: var(--text-on-primary); }.journey-item strong, .quick-item strong { display: block; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }.journey-item small, .quick-item small { display: block; overflow: hidden; margin-top: 4px; color: var(--text-mute); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.journey-item > svg, .quick-item > svg { flex: 0 0 auto; color: var(--text-mute); }
.quick-section { margin-top: 24px; }.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }.quick-item { min-height: 70px; }.quick-item > svg:first-child { color: var(--primary); }
@media (max-width: 1000px) { .content-grid { grid-template-columns: 1fr; }.journey-list, .quick-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 680px) { .workbench { padding: 20px 16px 36px; }.workbench-head { flex-direction: column; }.head-actions { width: 100%; justify-content: space-between; }.updated-at { white-space: normal; }.focus-panel { grid-template-columns: 1fr; padding: 20px; }.focus-state { padding: 16px 0 0; border-top: 1px solid var(--border-subtle); border-left: 0; }.metric-grid { grid-template-columns: repeat(2, 1fr); }.journey-list, .quick-grid { grid-template-columns: 1fr; } }
</style>
