<template>
  <div class="execute-detail">
    <div class="toolbar">
      <t-button theme="default" variant="outline" @click="$router.back()">返回</t-button>
      <span v-if="mainInfo" style="margin-left:20px">
        执行ID: {{ mainInfo.executionId }} |
        状态: <t-tag :theme="statusType(mainInfo.status)">{{ statusText(mainInfo.status) }}</t-tag> |
        耗时: {{ mainInfo.totalCostMs }}ms
      </span>
    </div>

    <div class="view-toggle">
      <t-radio-group v-model="viewMode" variant="default-filled" size="small">
        <t-radio-button value="flat">平铺视图</t-radio-button>
        <t-radio-button value="trace">分组视图</t-radio-button>
      </t-radio-group>
    </div>

    <!-- 平铺视图 -->
    <div class="nodes-area" v-if="viewMode === 'flat'">
      <div v-for="log in nodeLogs" :key="log.nodeCode" class="node-log-card" :class="'status-' + log.status.toLowerCase()">
        <div class="log-header">
          <span class="log-name">{{ log.nodeName || log.nodeCode }}</span>
          <t-tag size="small" :theme="statusType(log.status)">{{ statusText(log.status) }}</t-tag>
          <span class="log-cost">{{ log.costMs }}ms</span>
        </div>
        <div class="log-info">
          <div><strong>请求:</strong> {{ log.requestMethod }} {{ log.requestUrl }}</div>
          <div v-if="log.responseCode"><strong>响应码:</strong> {{ log.responseCode }}</div>
          <div v-if="log.errorMessage" class="log-error"><strong>错误:</strong> {{ log.errorMessage }}</div>
        </div>
        <div class="log-actions">
          <t-button size="small" theme="default" variant="outline" @click="showDetail(log)">查看详情</t-button>
          <t-button size="small" theme="warning" v-if="log.status === 'FAILED'" @click="analyzeFailure(log)">AI分析失败原因</t-button>
        </div>
      </div>
    </div>

    <!-- 分组视图 -->
    <div class="trace-groups-area" v-if="viewMode === 'trace'">
      <div v-for="(group, gIdx) in traceLogGroups" :key="gIdx" class="trace-group-card">
        <div class="trace-group-header">
          <div class="trace-group-info">
            <t-tag size="small" theme="primary" variant="dark">TraceId</t-tag>
            <span class="trace-group-id">{{ group.traceId }}</span>
          </div>
          <div class="trace-group-meta">
            <t-tag size="small" :theme="groupStatusType(group)">{{ groupStatusText(group) }}</t-tag>
            <span class="trace-group-cost">{{ groupCost(group) }}ms</span>
            <span class="trace-group-count">{{ group.logs.length }} 个节点</span>
          </div>
        </div>
        <div class="trace-group-nodes">
          <div v-for="log in group.logs" :key="log.nodeCode" class="trace-node-card" :class="'status-' + log.status.toLowerCase()">
            <div class="trace-node-index">{{ log.sortNo || '-' }}</div>
            <div class="trace-node-info">
              <div class="trace-node-name">{{ log.nodeName || log.nodeCode }}</div>
              <div class="trace-node-url">{{ log.requestMethod }} {{ log.requestUrl }}</div>
            </div>
            <div class="trace-node-right">
              <t-tag size="small" :theme="statusType(log.status)">{{ statusText(log.status) }}</t-tag>
              <span class="trace-node-cost">{{ log.costMs }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <t-dialog v-model:visible="detailVisible" header="节点详情" width="700px" :footer="false">
      <template v-if="currentLog">
        <t-descriptions :column="2" bordered size="small">
          <t-descriptions-item label="节点编码">{{ currentLog.nodeCode }}</t-descriptions-item>
          <t-descriptions-item label="状态">{{ statusText(currentLog.status) }}</t-descriptions-item>
          <t-descriptions-item label="请求方法">{{ currentLog.requestMethod }}</t-descriptions-item>
          <t-descriptions-item label="响应码">{{ currentLog.responseCode }}</t-descriptions-item>
          <t-descriptions-item label="耗时">{{ currentLog.costMs }}ms</t-descriptions-item>
        </t-descriptions>

        <div class="section-title">请求头</div>
        <MonacoEditor :model-value="formatJson(currentLog.requestHeaders)" language="json" :height="120" :readonly="true" />
        <t-button size="small" theme="default" variant="outline" @click="copyText(currentLog.requestHeaders)">复制</t-button>

        <div class="section-title">请求体</div>
        <MonacoEditor :model-value="formatJson(currentLog.requestBody)" language="json" :height="200" :readonly="true" />
        <t-button size="small" theme="default" variant="outline" @click="copyText(currentLog.requestBody)">复制</t-button>

        <div class="section-title">响应体</div>
        <MonacoEditor :model-value="formatJson(currentLog.responseBody)" language="json" :height="200" :readonly="true" />
        <t-button size="small" theme="default" variant="outline" @click="copyText(currentLog.responseBody)">复制</t-button>

        <div v-if="currentLog.errorMessage" class="section-title" style="color:#f56c6c">错误信息</div>
        <MonacoEditor v-if="currentLog.errorMessage" :model-value="currentLog.errorMessage" language="plaintext" :height="100" :readonly="true" />
      </template>
    </t-dialog>

    <t-dialog v-model:visible="aiVisible" header="AI分析结果" width="650px" :close-on-overlay-click="false" :footer="false">
      <div v-if="aiLoading" class="ai-loading">
        <LoadingIcon class="loading-icon" />
        <span>正在分析失败原因...</span>
      </div>
      <div v-else-if="aiResult">
        <div class="source-badge" :class="aiResult.source === 'AI智能分析' ? 'source-ai' : 'source-rule'">
          <AiIcon v-if="aiResult.source === 'AI智能分析'" />
          <DesktopIcon v-else />
          <span>{{ aiResult.source || '规则分析' }}</span>
          <span v-if="aiResult.source !== 'AI智能分析'" class="source-hint">（AI模型未配置，基于规则自动分析）</span>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <ErrorTriangleFilledIcon class="label-icon error" />
            根因定位
          </div>
          <div class="analysis-content">{{ aiResult.rootCause }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <InfoCircleFilledIcon class="label-icon info" />
            排查步骤
          </div>
          <div class="analysis-content">{{ aiResult.troubleshootingSteps }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <CheckCircleFilledIcon class="label-icon success" />
            修复方案
          </div>
          <div class="analysis-content">{{ aiResult.fixSuggestion }}</div>
        </div>
        <div class="analysis-footer">
          <t-button size="small" theme="default" variant="outline" @click="copyText(JSON.stringify(aiResult, null, 2))">
            <FileCopyIcon />复制全部
          </t-button>
        </div>
      </div>
      <div v-else class="ai-empty">
        <ErrorTriangleFilledIcon />
        <span>分析失败，请稍后重试</span>
      </div>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  LoadingIcon,
  ErrorTriangleFilledIcon,
  InfoCircleFilledIcon,
  CheckCircleFilledIcon,
  FileCopyIcon,
  AiIcon,
  DesktopIcon
} from 'tdesign-icons-vue-next'
import api from '../api'
import MonacoEditor from '../components/MonacoEditor.vue'

const route = useRoute()
const executionId = route.params.executionId

const mainInfo = ref(null)
const nodeLogs = ref([])
const detailVisible = ref(false)
const currentLog = ref(null)
const aiVisible = ref(false)
const aiResult = ref(null)
const aiLoading = ref(false)
const viewMode = ref('flat')
let ws = null

import { computed } from 'vue'

const traceLogGroups = computed(() => {
  const grouped = {}
  const order = []
  nodeLogs.value.forEach(log => {
    const traceId = log.bizOperTraceId || '__ungrouped__'
    if (!grouped[traceId]) {
      grouped[traceId] = { traceId, logs: [] }
      order.push(traceId)
    }
    grouped[traceId].logs.push(log)
  })
  return order.map(id => grouped[id])
})

const groupStatusType = (group) => {
  const hasFailed = group.logs.some(l => l.status === 'FAILED')
  const allSuccess = group.logs.every(l => l.status === 'SUCCESS')
  if (hasFailed) return 'danger'
  if (allSuccess) return 'success'
  return 'warning'
}

const groupStatusText = (group) => {
  const hasFailed = group.logs.some(l => l.status === 'FAILED')
  const allSuccess = group.logs.every(l => l.status === 'SUCCESS')
  if (hasFailed) return '失败'
  if (allSuccess) return '成功'
  return '部分成功'
}

const groupCost = (group) => {
  return group.logs.reduce((sum, l) => sum + (l.costMs || 0), 0)
}

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
    MessagePlugin.error('分析失败: ' + (e.response?.data?.message || e.message))
  } finally {
    aiLoading.value = false
  }
}

const formatJson = (str) => {
  if (!str) return ''
  try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
}

const copyText = (text) => { navigator.clipboard.writeText(text); MessagePlugin.success('已复制') }
// 返回 TDesign t-tag 的 theme 取值（Element 的 info 对应 TDesign 的 default）
const statusType = (s) => ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger', SKIPPED: 'default' }[s] || 'default')
const statusText = (s) => ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', PENDING: '待执行' }[s] || s)

onMounted(() => { loadData(); connectWs() })
onUnmounted(() => { if (ws) ws.close() })
</script>

<style scoped>
/* 内网/离线部署不要引入 Google Fonts CDN，否则白屏；已使用系统字体栈兜底 */

/* ── Layout ── */
.execute-detail {
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Toolbar ── */
.toolbar {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.toolbar > span {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.toolbar :deep(.el-button) {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar :deep(.el-button--primary) {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

/* ── Nodes Area ── */
.nodes-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Node Log Cards ── */
.node-log-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 14px;
  padding: 18px 20px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.node-log-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 4px 0 0 4px;
}

.node-log-card.status-success::before { background: #10b981; }
.node-log-card.status-failed::before { background: #ef4444; }
.node-log-card.status-running::before { background: #6366f1; }
.node-log-card.status-skipped::before { background: #9ca3af; }

.node-log-card:hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
  border-color: rgba(99, 102, 241, 0.18);
}

/* ── Running Pulse ── */
.node-log-card.status-running {
  animation: pulseGlow 2s infinite;
}

@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08); }
  50% { box-shadow: 0 4px 20px rgba(99, 102, 241, 0.18); }
}

/* ── Log Header ── */
.log-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.log-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e1b4b;
}

.log-cost {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
  margin-left: auto;
}

/* ── Log Info ── */
.log-info {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
  line-height: 1.6;
}

.log-info strong {
  color: #4338ca;
  font-weight: 600;
}

.log-error {
  color: #ef4444;
  margin-top: 6px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.06);
  border-radius: 8px;
}

/* ── Log Actions ── */
.log-actions {
  display: flex;
  gap: 8px;
}

.log-actions :deep(.el-button) {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

/* ── Tags ── */
:deep(.el-tag) {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Section Title ── */
.section-title {
  font-weight: 600;
  font-size: 13px;
  color: #4338ca;
  margin: 16px 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title[style*="color"] {
  color: #ef4444;
}

/* ── Dialog ── */
:deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), transparent);
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-descriptions) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-descriptions__label) {
  background: rgba(99, 102, 241, 0.04);
  font-weight: 500;
  color: #4338ca;
}

/* ── JSON Textarea ── */
:deep(.el-textarea) {
  border-radius: 10px;
}

:deep(.el-textarea textarea) {
  border-radius: 10px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}

/* ── AI Loading ── */
.ai-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: #9ca3af;
  font-weight: 500;
}

.loading-icon {
  font-size: 40px;
  color: #6366f1;
  margin-bottom: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── AI Result ── */
.analysis-section {
  margin-bottom: 18px;
}

.analysis-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
  color: #1e1b4b;
}

.label-icon { font-size: 18px; }
.label-icon.error { color: #ef4444; }
.label-icon.info { color: #6366f1; }
.label-icon.success { color: #10b981; }

.analysis-content {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(129, 140, 248, 0.02));
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 12px;
  font-size: 13px;
  color: #374151;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}

.analysis-footer {
  padding-top: 14px;
  border-top: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  justify-content: flex-end;
}

/* ── AI Empty ── */
.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: #9ca3af;
  font-weight: 500;
}

.ai-empty .el-icon {
  font-size: 40px;
  margin-bottom: 12px;
  color: #f59e0b;
}

/* ── Source Badge ── */
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 18px;
}

.source-ai {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(129, 140, 248, 0.08));
  color: #6366f1;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.source-rule {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.06));
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.source-hint {
  font-weight: 400;
  font-size: 12px;
  color: #9ca3af;
}

/* ── View Toggle ── */
.view-toggle {
  display: flex;
  justify-content: flex-start;
  padding: 0 4px;
}

/* ── Trace Groups Area ── */
.trace-groups-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trace-group-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.trace-group-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(129, 140, 248, 0.03));
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.trace-group-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trace-group-id {
  font-size: 13px;
  font-weight: 600;
  color: #1e1b4b;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.trace-group-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #6b7280;
}

.trace-group-cost {
  font-weight: 500;
  color: #4338ca;
}

.trace-group-count {
  color: #9ca3af;
}

.trace-group-nodes {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trace-node-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(99, 102, 241, 0.06);
  border-radius: 8px;
  background: #fff;
  transition: all 0.2s;
}

.trace-node-card:hover {
  border-color: rgba(99, 102, 241, 0.2);
}

.trace-node-card.status-success {
  border-left: 3px solid #10b981;
}

.trace-node-card.status-failed {
  border-left: 3px solid #ef4444;
}

.trace-node-card.status-running {
  border-left: 3px solid #6366f1;
}

.trace-node-card.status-skipped {
  border-left: 3px solid #9ca3af;
}

.trace-node-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  flex-shrink: 0;
}

.trace-node-info {
  flex: 1;
  min-width: 0;
}

.trace-node-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e1b4b;
}

.trace-node-url {
  font-size: 11px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-node-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.trace-node-cost {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}
</style>
