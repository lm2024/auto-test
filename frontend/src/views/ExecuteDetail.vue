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

    <div class="view-toggle">
      <el-button-group>
        <el-button :type="viewMode === 'flat' ? 'primary' : ''" @click="viewMode = 'flat'" size="small">平铺视图</el-button>
        <el-button :type="viewMode === 'trace' ? 'primary' : ''" @click="viewMode = 'trace'" size="small">分组视图</el-button>
      </el-button-group>
    </div>

    <!-- 平铺视图 -->
    <div class="nodes-area" v-if="viewMode === 'flat'">
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

    <!-- 分组视图 -->
    <div class="trace-groups-area" v-if="viewMode === 'trace'">
      <div v-for="(group, gIdx) in traceLogGroups" :key="gIdx" class="trace-group-card">
        <div class="trace-group-header">
          <div class="trace-group-info">
            <el-tag size="small" type="primary" effect="dark">TraceId</el-tag>
            <span class="trace-group-id">{{ group.traceId }}</span>
          </div>
          <div class="trace-group-meta">
            <el-tag size="small" :type="groupStatusType(group)">{{ groupStatusText(group) }}</el-tag>
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
              <el-tag size="small" :type="statusType(log.status)">{{ statusText(log.status) }}</el-tag>
              <span class="trace-node-cost">{{ log.costMs }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog :visible.sync="detailVisible" title="节点详情" width="700px">
      <template v-if="currentLog">
        <table class="detail-table" border="1" cellpadding="8" cellspacing="0">
          <tr v-for="item in currentLogDesc" :key="item.label">
            <td class="detail-label">{{ item.label }}</td>
            <td class="detail-value">{{ item.value }}</td>
          </tr>
        </table>

        <div class="section-title">请求头</div>
        <el-input :value="formatJson(currentLog.requestHeaders)" type="textarea" :rows="3" readonly />
        <el-button size="small" @click="copyText(currentLog.requestHeaders)">复制</el-button>

        <div class="section-title">请求体</div>
        <el-input :value="formatJson(currentLog.requestBody)" type="textarea" :rows="5" readonly />
        <el-button size="small" @click="copyText(currentLog.requestBody)">复制</el-button>

        <div class="section-title">响应体</div>
        <el-input :value="formatJson(currentLog.responseBody)" type="textarea" :rows="5" readonly />
        <el-button size="small" @click="copyText(currentLog.responseBody)">复制</el-button>

        <div v-if="currentLog.errorMessage" class="section-title" style="color:#f56c6c">错误信息</div>
        <el-input v-if="currentLog.errorMessage" :value="currentLog.errorMessage" type="textarea" :rows="3" readonly />
      </template>
    </el-dialog>

    <el-dialog :visible.sync="aiVisible" title="AI分析结果" width="650px" :close-on-click-modal="false">
      <div v-if="aiLoading" class="ai-loading">
        <i class="el-icon-loading loading-icon"></i>
        <span>正在分析失败原因...</span>
      </div>
      <div v-else-if="aiResult">
        <div class="source-badge" :class="aiResult.source === 'AI智能分析' ? 'source-ai' : 'source-rule'">
          <i v-if="aiResult.source === 'AI智能分析'" class="el-icon-magic-stick"></i>
          <i v-else class="el-icon-monitor"></i>
          <span>{{ aiResult.source || '规则分析' }}</span>
          <span v-if="aiResult.source !== 'AI智能分析'" class="source-hint">（AI模型未配置，基于规则自动分析）</span>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <i class="el-icon-warning label-icon error"></i>
            根因定位
          </div>
          <div class="analysis-content">{{ aiResult.rootCause }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <i class="el-icon-info label-icon info"></i>
            排查步骤
          </div>
          <div class="analysis-content">{{ aiResult.troubleshootingSteps }}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-label">
            <i class="el-icon-success label-icon success"></i>
            修复方案
          </div>
          <div class="analysis-content">{{ aiResult.fixSuggestion }}</div>
        </div>
        <div class="analysis-footer">
          <el-button size="small" @click="copyText(JSON.stringify(aiResult, null, 2))" icon="el-icon-document-copy">复制全部</el-button>
        </div>
      </div>
      <div v-else class="ai-empty">
        <i class="el-icon-warning"></i>
        <span>分析失败，请稍后重试</span>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { Message } from 'element-ui'
import api from '../api'

export default {
  name: 'ExecuteDetail',
  data() {
    return {
      executionId: '',
      mainInfo: null,
      nodeLogs: [],
      detailVisible: false,
      currentLog: null,
      aiVisible: false,
      aiResult: null,
      aiLoading: false,
      viewMode: 'flat',
      ws: null
    }
  },
  computed: {
    currentLogDesc() {
      if (!this.currentLog) return []
      return [
        { label: '节点编码', value: this.currentLog.nodeCode },
        { label: '状态', value: this.statusText(this.currentLog.status) },
        { label: '请求方法', value: this.currentLog.requestMethod },
        { label: '响应码', value: this.currentLog.responseCode },
        { label: '耗时', value: this.currentLog.costMs + 'ms' }
      ]
    },
    traceLogGroups() {
      const grouped = {}
      const order = []
      this.nodeLogs.forEach(log => {
        const traceId = log.bizOperTraceId || '__ungrouped__'
        if (!grouped[traceId]) {
          grouped[traceId] = { traceId, logs: [] }
          order.push(traceId)
        }
        grouped[traceId].logs.push(log)
      })
      return order.map(id => grouped[id])
    }
  },
  mounted() {
    this.executionId = this.$route.params.executionId
    this.loadData()
    this.connectWs()
  },
  beforeDestroy() {
    if (this.ws) this.ws.close()
  },
  methods: {
    async loadData() {
      const res = await api.get('/execute/status', { params: { executionId: this.executionId } })
      this.mainInfo = res.data
      const logRes = await api.get('/execute/nodeLogs', { params: { executionId: this.executionId } })
      this.nodeLogs = logRes.data || []
    },
    connectWs() {
      const wsUrl = 'ws://' + location.host + '/ws/execute/' + this.executionId
      this.ws = new WebSocket(wsUrl)
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'NODE_STATUS') {
          const node = this.nodeLogs.find(n => n.nodeCode === msg.nodeCode)
          if (node) {
            node.status = msg.status
            node.costMs = msg.costMs
          }
        } else if (msg.type === 'CHAIN_STATUS') {
          this.loadData()
        }
      }
      this.ws.onclose = () => { const self = this; setTimeout(() => self.connectWs(), 3000) }
      this.ws.onerror = () => { if (this.ws) this.ws.close() }
    },
    showDetail(log) {
      this.currentLog = log
      this.detailVisible = true
    },
    async analyzeFailure(log) {
      this.aiResult = null
      this.aiLoading = true
      this.aiVisible = true
      try {
        const res = await api.post('/ai/failure/analyze', { executionId: this.executionId, nodeCode: log.nodeCode })
        this.aiResult = res.data
      } catch (e) {
        Message.error('分析失败: ' + (e.response && e.response.data && e.response.data.message || e.message))
      } finally {
        this.aiLoading = false
      }
    },
    formatJson(str) {
      if (!str) return ''
      try { return JSON.stringify(JSON.parse(str), null, 2) } catch { return str }
    },
    copyText(text) { navigator.clipboard.writeText(text); Message.success('已复制') },
    statusType(s) { return { RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger', SKIPPED: 'info' }[s] || 'info' },
    statusText(s) { return { RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败', SKIPPED: '跳过', PENDING: '待执行' }[s] || s },
    groupStatusType(group) {
      const hasFailed = group.logs.some(l => l.status === 'FAILED')
      const allSuccess = group.logs.every(l => l.status === 'SUCCESS')
      if (hasFailed) return 'danger'
      if (allSuccess) return 'success'
      return 'warning'
    },
    groupStatusText(group) {
      const hasFailed = group.logs.some(l => l.status === 'FAILED')
      const allSuccess = group.logs.every(l => l.status === 'SUCCESS')
      if (hasFailed) return '失败'
      if (allSuccess) return '成功'
      return '部分成功'
    },
    groupCost(group) {
      return group.logs.reduce((sum, l) => sum + (l.costMs || 0), 0)
    }
  }
}
</script>

<style scoped>
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

/* ── Detail Table ── */
.detail-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  border: 1px solid rgba(99, 102, 241, 0.1);
}

.detail-label {
  background: rgba(99, 102, 241, 0.04);
  font-weight: 500;
  color: #4338ca;
  font-size: 13px;
  width: 120px;
}

.detail-value {
  font-size: 13px;
  color: #374151;
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

<style>
/* ── Global overrides for Element UI ── */
.execute-detail .toolbar .el-button {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.execute-detail .toolbar .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.execute-detail .log-actions .el-button {
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.execute-detail .el-tag {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

.execute-detail .el-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.execute-detail .el-dialog__header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), transparent);
}

.execute-detail .el-dialog__body {
  padding: 24px;
}

.execute-detail .el-textarea textarea {
  border-radius: 10px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.6;
}
</style>
