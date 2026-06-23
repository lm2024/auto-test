<template>
  <div class="browser-exec-detail">
    <div class="page-header">
      <el-button @click="$router.back()" :icon="ArrowLeft">返回</el-button>
      <span v-if="mainInfo">执行ID: {{ mainInfo.executionId }} | 状态: <el-tag :type="statusType(mainInfo.status)">{{ statusText(mainInfo.status) }}</el-tag> | 耗时: {{ mainInfo.totalCostMs }}ms</span>
      <el-button v-if="mainInfo?.status === 'RUNNING'" size="small" type="warning" :icon="Loading" loading>执行中...</el-button>
    </div>

    <div class="view-toggle">
      <el-button-group>
        <el-button :type="viewMode === 'flat' ? 'primary' : ''" @click="viewMode = 'flat'" size="small">平铺视图</el-button>
        <el-button :type="viewMode === 'trace' ? 'primary' : ''" @click="viewMode = 'trace'" size="small">分组视图</el-button>
      </el-button-group>
    </div>

    <!-- 平铺视图 -->
    <div class="steps-area" v-if="viewMode === 'flat'">
      <div v-for="(log, idx) in stepLogs" :key="idx" class="step-card" :class="'status-' + log.status.toLowerCase()" @click="showScreenshot(log)">
        <div class="step-header">
          <span class="step-index">#{{ log.stepIndex }}</span>
          <span class="step-name">{{ log.description || log.actionType }}</span>
          <el-tag size="small" :type="statusType(log.status)">{{ statusText(log.status) }}</el-tag>
          <span class="step-cost">{{ log.costMs }}ms</span>
        </div>
        <div class="step-info" v-if="log.pageUrl">
          <div>页面: {{ log.pageUrl }}</div>
          <div v-if="log.errorMessage" class="step-error">{{ log.errorMessage }}</div>
        </div>
        <div class="step-screenshot" v-if="log.screenshotUrl">
          <img :src="log.screenshotUrl" alt="screenshot" loading="lazy" />
        </div>
      </div>
      <div v-if="stepLogs.length === 0" class="empty">暂无步骤日志</div>
    </div>

    <!-- 分组视图 -->
    <div class="trace-area" v-if="viewMode === 'trace'">
      <div v-for="(group, gIdx) in traceGroups" :key="gIdx" class="trace-group-card">
        <div class="trace-group-header">
          <el-tag size="small" type="primary" effect="dark">TraceId</el-tag>
          <span class="trace-id">{{ group.traceId }}</span>
          <el-tag size="small" :type="groupStatusType(group)">{{ groupStatusText(group) }}</el-tag>
          <span class="trace-cost">{{ groupCost(group) }}ms</span>
        </div>
        <div class="trace-group-steps">
          <div v-for="log in group.logs" :key="log.stepIndex" class="trace-step" :class="'status-' + log.status.toLowerCase()" @click="showScreenshot(log)">
            <span class="trace-step-idx">#{{ log.stepIndex }}</span>
            <span class="trace-step-name">{{ log.description || log.actionType }}</span>
            <el-tag size="small" :type="statusType(log.status)">{{ statusText(log.status) }}</el-tag>
            <span class="trace-step-cost">{{ log.costMs }}ms</span>
          </div>
        </div>
      </div>
      <div v-if="stepLogs.length === 0" class="empty">暂无步骤日志</div>
    </div>

    <!-- 截图放大弹窗 -->
    <el-dialog v-model="screenshotVisible" title="步骤截图" width="900px">
      <img v-if="currentScreenshot" :src="currentScreenshot" style="width:100%; border-radius:8px" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loading } from '@element-plus/icons-vue'
import { browserApi } from '../api/browser'

const route = useRoute()
const executionId = route.params.executionId

const mainInfo = ref(null)
const stepLogs = ref([])
const viewMode = ref('flat')
const screenshotVisible = ref(false)
const currentScreenshot = ref('')
let ws = null

const traceGroups = computed(() => {
  const grouped = {}
  const order = []
  stepLogs.value.forEach(log => {
    const traceId = log.bizOperTraceId || '__ungrouped__'
    if (!grouped[traceId]) { grouped[traceId] = { traceId, logs: [] }; order.push(traceId) }
    grouped[traceId].logs.push(log)
  })
  return order.map(id => grouped[id])
})

const groupStatusType = (g) => {
  const hasFailed = g.logs.some(l => l.status === 'FAILED')
  const allSuccess = g.logs.every(l => l.status === 'SUCCESS')
  if (hasFailed) return 'danger'
  if (allSuccess) return 'success'
  return 'warning'
}
const groupStatusText = (g) => groupStatusType(g) === 'danger' ? '失败' : groupStatusType(g) === 'success' ? '成功' : '部分成功'
const groupCost = (g) => g.logs.reduce((s, l) => s + (l.costMs || 0), 0)

const loadData = async () => {
  try {
    const res = await browserApi.execDetail(executionId)
    mainInfo.value = res.data
  } catch (e) { /* ignore */ }
  try {
    const logRes = await browserApi.stepLogs(executionId)
    stepLogs.value = logRes.data || []
  } catch (e) { /* ignore */ }
}

const connectWs = () => {
  // AIEXEC_ 前缀的执行使用 /ws/browser/（由 ExecuteController 中的 WebSocket 推送）
  const wsPath = executionId.startsWith('AIEXEC_') ? '/ws/browser/' : '/ws/browser/'
  const wsUrl = `ws://${location.host}${wsPath}${executionId}`
  ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.type === 'STEP_LOG') {
      const idx = stepLogs.value.findIndex(s => s.stepIndex === msg.stepIndex)
      if (idx >= 0) Object.assign(stepLogs.value[idx], msg)
      else stepLogs.value.push(msg)
    } else if (msg.type === 'EXEC_STATUS') {
      if (mainInfo.value) mainInfo.value.status = msg.status
    }
  }
  ws.onclose = () => setTimeout(connectWs, 3000)
  ws.onerror = () => ws.close()
}

const showScreenshot = (log) => {
  if (log.screenshotUrl) {
    currentScreenshot.value = log.screenshotUrl
    screenshotVisible.value = true
  }
}

const statusType = (s) => ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger', SKIPPED: 'info' }[s] || 'info')
const statusText = (s) => ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', PENDING: '待执行' }[s] || s)

onMounted(() => { loadData(); connectWs() })
onUnmounted(() => { if (ws) ws.close() })
</script>

<style scoped>
.browser-exec-detail { display: flex; flex-direction: column; gap: 16px; }
.page-header { padding: 16px 20px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border: 1px solid rgba(99,102,241,0.08); border-radius: 14px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.page-header > span { font-size: 13px; color: #6b7280; font-weight: 500; }
.view-toggle { display: flex; padding: 0 4px; }
.steps-area, .trace-area { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.step-card { background: rgba(255,255,255,0.9); border: 1px solid rgba(99,102,241,0.1); border-radius: 14px; padding: 16px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
.step-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 4px 0 0 4px; }
.step-card.status-success::before { background: #10b981; }
.step-card.status-failed::before { background: #ef4444; }
.step-card.status-running::before { background: #6366f1; }
.step-card:hover { box-shadow: 0 4px 16px rgba(99,102,241,0.1); transform: translateY(-1px); }
.step-header { display: flex; align-items: center; gap: 10px; }
.step-index { font-weight: 700; color: #6366f1; font-size: 14px; }
.step-name { font-weight: 600; font-size: 14px; color: #1e1b4b; flex: 1; }
.step-cost { color: #9ca3af; font-size: 12px; margin-left: auto; }
.step-info { font-size: 12px; color: #6b7280; margin-top: 6px; }
.step-error { color: #ef4444; margin-top: 4px; padding: 6px 10px; background: rgba(239,68,68,0.06); border-radius: 6px; }
.step-screenshot { margin-top: 10px; }
.step-screenshot img { width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(99,102,241,0.08); }
.empty { text-align: center; padding: 48px; color: #9ca3af; }
.trace-group-card { background: rgba(255,255,255,0.9); border: 1px solid rgba(99,102,241,0.1); border-radius: 14px; overflow: hidden; }
.trace-group-header { padding: 12px 16px; background: rgba(99,102,241,0.06); border-bottom: 1px solid rgba(99,102,241,0.08); display: flex; align-items: center; gap: 10px; }
.trace-id { font-weight: 600; color: #1e1b4b; font-family: monospace; font-size: 13px; flex: 1; }
.trace-cost { color: #4338ca; font-weight: 500; font-size: 12px; }
.trace-group-steps { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.trace-step { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.trace-step:hover { background: rgba(99,102,241,0.04); }
.trace-step.status-success { border-left: 3px solid #10b981; }
.trace-step.status-failed { border-left: 3px solid #ef4444; }
.trace-step-idx { font-weight: 700; color: #6366f1; min-width: 32px; font-size: 12px; }
.trace-step-name { flex: 1; font-size: 13px; color: #1e1b4b; }
.trace-step-cost { color: #9ca3af; font-size: 11px; }
</style>
