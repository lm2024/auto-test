<template>
  <div class="execute-detail">
    <div class="toolbar">
      <el-button @click="$router.back()">返回</el-button>
      <span v-if="mainInfo" style="margin-left:20px">
        执行ID: {{ mainInfo.executionId }} |
        状态: <el-tag :type="statusType(mainInfo.status)">{{ statusText(mainInfo.status) }}</el-tag> |
        耗时: {{ mainInfo.totalCostMs }}ms
      </span>
    </div>

    <div class="nodes-area">
      <div v-for="log in nodeLogs" :key="log.nodeCode" class="node-log-card" :class="'status-' + log.status.toLowerCase()">
        <div class="log-header">
          <span class="log-name">{{ log.nodeName || log.nodeCode }}</span>
          <el-tag size="small" :type="statusType(log.status)">{{ statusText(log.status) }}</el-tag>
          <span class="log-cost">{{ log.costMs }}ms</span>
        </div>
        <div class="log-info">
          <div><strong>请求:</strong> {{ log.requestMethod }} {{ log.requestUrl }}</div>
          <div v-if="log.responseCode"><strong>响应码:</strong> {{ log.responseCode }}</div>
          <div v-if="log.errorMessage" class="log-error"><strong>错误:</strong> {{ log.errorMessage }}</div>
        </div>
        <div class="log-actions">
          <el-button size="small" @click="showDetail(log)">查看详情</el-button>
          <el-button size="small" type="warning" v-if="log.status === 'FAILED'" @click="analyzeFailure(log)">AI分析失败原因</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="节点详情" width="700px">
      <template v-if="currentLog">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="节点编码">{{ currentLog.nodeCode }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusText(currentLog.status) }}</el-descriptions-item>
          <el-descriptions-item label="请求方法">{{ currentLog.requestMethod }}</el-descriptions-item>
          <el-descriptions-item label="响应码">{{ currentLog.responseCode }}</el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentLog.costMs }}ms</el-descriptions-item>
        </el-descriptions>

        <div class="section-title">请求头</div>
        <el-input :model-value="formatJson(currentLog.requestHeaders)" type="textarea" :rows="3" readonly />
        <el-button size="small" @click="copyText(currentLog.requestHeaders)">复制</el-button>

        <div class="section-title">请求体</div>
        <el-input :model-value="formatJson(currentLog.requestBody)" type="textarea" :rows="5" readonly />
        <el-button size="small" @click="copyText(currentLog.requestBody)">复制</el-button>

        <div class="section-title">响应体</div>
        <el-input :model-value="formatJson(currentLog.responseBody)" type="textarea" :rows="5" readonly />
        <el-button size="small" @click="copyText(currentLog.responseBody)">复制</el-button>

        <div v-if="currentLog.errorMessage" class="section-title" style="color:#f56c6c">错误信息</div>
        <el-input v-if="currentLog.errorMessage" :model-value="currentLog.errorMessage" type="textarea" :rows="3" readonly />
      </template>
    </el-dialog>

    <el-dialog v-model="aiVisible" title="AI分析结果" width="650px" :close-on-click-modal="false">
      <div v-if="aiLoading" class="ai-loading">
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>正在分析失败原因...</span>
      </div>
      <div v-else-if="aiResult">
        <div class="source-badge" :class="aiResult.source === 'AI智能分析' ? 'source-ai' : 'source-rule'">
          <el-icon v-if="aiResult.source === 'AI智能分析'"><MagicStick /></el-icon>
          <el-icon v-else><Monitor /></el-icon>
          <span>{{ aiResult.source || '规则分析' }}</span>
          <span v-if="aiResult.source !== 'AI智能分析'" class="source-hint">（AI模型未配置，基于规则自动分析）</span>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <el-icon class="label-icon error"><WarningFilled /></el-icon>
            根因定位
          </div>
          <div class="analysis-content">{{ aiResult.rootCause }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <el-icon class="label-icon info"><InfoFilled /></el-icon>
            排查步骤
          </div>
          <div class="analysis-content">{{ aiResult.troubleshootingSteps }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <el-icon class="label-icon success"><CircleCheckFilled /></el-icon>
            修复方案
          </div>
          <div class="analysis-content">{{ aiResult.fixSuggestion }}</div>
        </div>
        <div class="analysis-footer">
          <el-button size="small" @click="copyText(JSON.stringify(aiResult, null, 2))" :icon="DocumentCopy">复制全部</el-button>
        </div>
      </div>
      <div v-else class="ai-empty">
        <el-icon><WarningFilled /></el-icon>
        <span>分析失败，请稍后重试</span>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, WarningFilled, InfoFilled, CircleCheckFilled, DocumentCopy, MagicStick, Monitor } from '@element-plus/icons-vue'
import api from '../api'

const route = useRoute()
const executionId = route.params.executionId

const mainInfo = ref(null)
const nodeLogs = ref([])
const detailVisible = ref(false)
const currentLog = ref(null)
const aiVisible = ref(false)
const aiResult = ref(null)
const aiLoading = ref(false)
let ws = null

const loadData = async () => {
  const res = await api.get('/execute/status', { params: { executionId } })
  mainInfo.value = res.data
  const logRes = await api.get('/execute/nodeLogs', { params: { executionId } })
  nodeLogs.value = logRes.data || []
}

const connectWs = () => {
  const wsUrl = `ws://${location.host}/ws/execute/${executionId}`
  ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.type === 'NODE_STATUS') {
      const node = nodeLogs.value.find(n => n.nodeCode === msg.nodeCode)
      if (node) {
        node.status = msg.status
        node.costMs = msg.costMs
      }
    } else if (msg.type === 'CHAIN_STATUS') {
      loadData()
    }
  }
  ws.onclose = () => setTimeout(connectWs, 3000)
  ws.onerror = () => ws.close()
}

const showDetail = (log) => {
  currentLog.value = log
  detailVisible.value = true
}

const analyzeFailure = async (log) => {
  aiResult.value = null
  aiLoading.value = true
  aiVisible.value = true
  try {
    const res = await api.post('/ai/failure/analyze', { executionId, nodeCode: log.nodeCode })
    aiResult.value = res.data
  } catch (e) {
    ElMessage.error('分析失败: ' + (e.response?.data?.message || e.message))
  } finally {
    aiLoading.value = false
  }
}

const formatJson = (str) => {
  if (!str) return ''
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}

const copyText = (text) => { navigator.clipboard.writeText(text); ElMessage.success('已复制') }
const statusType = (s) => ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger', SKIPPED: 'info' }[s] || 'info')
const statusText = (s) => ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', PENDING: '待执行' }[s] || s)

onMounted(() => { loadData(); connectWs() })
onUnmounted(() => { if (ws) ws.close() })
</script>

<style scoped>
.execute-detail { height: calc(100vh - 80px); display: flex; flex-direction: column; }
.toolbar { padding: 10px; background: #fff; border-bottom: 1px solid #e4e7ed; }
.nodes-area { flex: 1; overflow-y: auto; padding: 15px; }
.node-log-card { background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; padding: 15px; margin-bottom: 12px; }
.node-log-card.status-success { border-left: 4px solid #67c23a; }
.node-log-card.status-failed { border-left: 4px solid #f56c6c; }
.node-log-card.status-running { border-left: 4px solid #409eff; }
.node-log-card.status-skipped { border-left: 4px solid #909399; }
.log-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.log-name { font-weight: bold; font-size: 14px; }
.log-cost { color: #909399; font-size: 12px; }
.log-info { font-size: 13px; color: #606266; margin-bottom: 8px; }
.log-error { color: #f56c6c; }
.log-actions { display: flex; gap: 8px; }
.section-title { font-weight: bold; margin: 15px 0 8px; }
.ai-loading { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #909399; }
.loading-icon { font-size: 36px; color: #409eff; margin-bottom: 12px; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.analysis-section { margin-bottom: 16px; }
.analysis-label { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #303133; }
.label-icon { font-size: 16px; }
.label-icon.error { color: #f56c6c; }
.label-icon.info { color: #409eff; }
.label-icon.success { color: #67c23a; }
.analysis-content { padding: 12px; background: #f5f7fa; border-radius: 8px; font-size: 13px; color: #606266; line-height: 1.8; white-space: pre-wrap; word-break: break-all; }
.analysis-footer { padding-top: 12px; border-top: 1px solid #ebeef5; display: flex; justify-content: flex-end; }
.ai-empty { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #909399; }
.ai-empty .el-icon { font-size: 36px; margin-bottom: 12px; color: #e6a23c; }
.source-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
  margin-bottom: 16px;
}
.source-ai { background: #ecf5ff; color: #409eff; border: 1px solid #b3d8ff; }
.source-rule { background: #fdf6ec; color: #e6a23c; border: 1px solid #f5dab1; }
.source-hint { font-weight: 400; font-size: 12px; color: #909399; }
</style>
