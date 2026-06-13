<template>
  <div class="chain-edit">
    <div class="toolbar">
      <el-button @click="$router.back()">返回</el-button>
      <el-button type="primary" @click="saveAll">保存</el-button>
      <el-button @click="undo" :disabled="!canUndo">撤销</el-button>
      <el-button @click="redo" :disabled="!canRedo">重做</el-button>
      <el-button @click="autoLayout">自动布局</el-button>
      <el-button type="warning" @click="generateTestData" :loading="aiLoading">AI生成测试数据</el-button>
      <el-button type="success" @click="executeChain" :disabled="nodes.length === 0">执行</el-button>
    </div>

    <div class="main-area">
      <div class="left-panel">
        <div class="panel-title">节点库</div>
        <div class="node-item" draggable @dragstart="onDragStart">
          <el-icon><Connection /></el-icon>
          <span>HTTP请求节点</span>
        </div>
        <el-button size="small" style="margin-top:10px;width:100%" @click="openImportDialog">批量导入</el-button>
      </div>

      <div class="center-panel" ref="canvasRef" @drop="onDrop" @dragover.prevent>
        <div v-if="nodes.length === 0" class="empty-hint">拖拽节点到此处或批量导入接口</div>
        <template v-for="(node, index) in sortedNodes" :key="node.nodeCode">
          <div class="node-card"
               :class="{ selected: selectedNode?.nodeCode === node.nodeCode, 'status-running': nodeStatusMap[node.nodeCode] === 'RUNNING', 'status-success': nodeStatusMap[node.nodeCode] === 'SUCCESS', 'status-failed': nodeStatusMap[node.nodeCode] === 'FAILED' }"
               @click="selectNode(node)">
            <div class="node-header">
              <span class="node-name">{{ node.nodeName || node.nodeCode }}</span>
              <el-tag size="small" :type="methodType(node.requestMethod)">{{ node.requestMethod }}</el-tag>
            </div>
            <div class="node-url">{{ node.requestUrl }}</div>
            <div v-if="nodeStatusMap[node.nodeCode]" class="node-status">
              {{ nodeStatusMap[node.nodeCode] }}
            </div>
          </div>
          <div v-if="index < sortedNodes.length - 1" class="connection-arrow">↓</div>
        </template>
        <div style="text-align:center;margin-top:10px">
          <el-button type="primary" plain @click="addNode">+ 新增</el-button>
        </div>
      </div>

      <div class="right-panel" v-if="selectedNode">
        <div class="panel-title">属性配置 - {{ selectedNode.nodeName }}</div>
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基础信息" name="basic">
            <el-form label-width="80px" size="small">
              <el-form-item label="节点名称">
                <el-input v-model="selectedNode.nodeName" />
              </el-form-item>
              <el-form-item label="排序号">
                <el-input-number v-model="selectedNode.sortNo" :min="1" />
              </el-form-item>
              <el-form-item label="并行分组">
                <el-input v-model="selectedNode.parallelGroup" placeholder="为空则串行" />
              </el-form-item>
              <el-form-item label="等待时间">
                <el-input-number v-model="selectedNode.delaySeconds" :min="0" :max="3600" />
                <span style="margin-left:8px;color:#909399;font-size:12px">秒，执行后等待再执行下一节点</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="请求配置" name="request">
            <el-form label-width="80px" size="small">
              <el-form-item label="URL">
                <el-input v-model="selectedNode.requestUrl" />
              </el-form-item>
              <el-form-item label="方法">
                <el-select v-model="selectedNode.requestMethod">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                  <el-option label="PATCH" value="PATCH" />
                </el-select>
              </el-form-item>
              <el-form-item label="请求头">
                <el-input v-model="selectedNode.requestHeaders" type="textarea" :rows="4" placeholder='{"Content-Type":"application/json"}' />
                <el-button size="small" @click="formatJson('requestHeaders')">格式化</el-button>
                <el-button size="small" @click="copyText(selectedNode.requestHeaders)">复制</el-button>
              </el-form-item>
              <el-form-item label="请求体">
                <el-input v-model="selectedNode.bodyData" type="textarea" :rows="6" />
                <el-button size="small" @click="formatJson('bodyData')">格式化</el-button>
                <el-button size="small" @click="copyText(selectedNode.bodyData)">复制</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="提取规则" name="extract">
            <el-input v-model="selectedNode.extractRules" type="textarea" :rows="8"
              placeholder='{"rules":[{"varName":"userId","jsonPath":"$.data.id"}]}' />
          </el-tab-pane>
          <el-tab-pane label="断言规则" name="assert">
            <el-input v-model="selectedNode.assertRules" type="textarea" :rows="6"
              placeholder='{"statusCode":200,"body":{"$.code":200}}' />
          </el-tab-pane>
        </el-tabs>
        <div style="margin-top:10px">
          <el-button type="primary" @click="saveNode">保存节点</el-button>
          <el-button type="danger" @click="deleteNode">删除节点</el-button>
        </div>
      </div>
      <div class="right-panel" v-else>
        <div class="empty-hint" style="padding:40px">点击左侧节点查看配置</div>
      </div>
    </div>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="批量导入接口" width="700px" :close-on-click-modal="false">
      <el-tabs v-model="importTab">
        <el-tab-pane label="Swagger/OpenAPI" name="swagger">
          <el-form label-width="100px">
            <el-form-item label="API文档URL">
              <el-input v-model="swaggerUrl" placeholder="https://petstore.swagger.io/v2/swagger.json" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="importFromSwagger" :loading="importLoading">解析并导入</el-button>
            </el-form-item>
          </el-form>
          <div v-if="swaggerResult.length" style="margin-top:15px">
            <div style="font-weight:600;margin-bottom:10px">解析结果 ({{ swaggerResult.length }}个接口)</div>
            <el-table :data="swaggerResult" border size="small" max-height="300">
              <el-table-column type="selection" width="40" />
              <el-table-column prop="nodeName" label="名称" />
              <el-table-column prop="method" label="方法" width="80" />
              <el-table-column prop="url" label="URL" show-overflow-tooltip />
            </el-table>
            <el-button type="primary" style="margin-top:10px" @click="confirmSwaggerImport">确认导入选中</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="JSON文件" name="json">
          <el-upload
            ref="jsonUploadRef"
            drag
            :auto-upload="false"
            :on-change="handleJsonFile"
            accept=".json"
            :limit="1"
          >
            <el-icon style="font-size:40px;color:#909399"><UploadFilled /></el-icon>
            <div>拖拽JSON文件到此处，或<em>点击上传</em></div>
            <template #tip>
              <div style="color:#909399;font-size:12px">支持格式：Postman Collection、Insomnia Export、自定义JSON</div>
            </template>
          </el-upload>
          <div v-if="jsonPreview.length" style="margin-top:15px">
            <div style="font-weight:600;margin-bottom:10px">预览 ({{ jsonPreview.length }}个接口)</div>
            <el-table :data="jsonPreview" border size="small" max-height="250">
              <el-table-column type="selection" width="40" />
              <el-table-column prop="nodeName" label="名称" />
              <el-table-column prop="method" label="方法" width="80" />
              <el-table-column prop="url" label="URL" show-overflow-tooltip />
            </el-table>
            <el-button type="primary" style="margin-top:10px" @click="confirmJsonImport">确认导入选中</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="cURL命令" name="curl">
          <el-input v-model="curlCommand" type="textarea" :rows="8" placeholder='粘贴cURL命令，例如：
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d &apos;{"name":"test"}&apos;' />
          <el-button type="primary" style="margin-top:10px" @click="importFromCurl" :loading="importLoading">解析并导入</el-button>
        </el-tab-pane>

        <el-tab-pane label="直接粘贴JSON" name="paste">
          <el-input v-model="pasteJson" type="textarea" :rows="10" placeholder='粘贴JSON数组，格式：
[
  {
    "nodeName": "获取用户",
    "method": "GET",
    "url": "https://api.example.com/users/1",
    "headers": "{\"Authorization\":\"Bearer xxx\"}",
    "bodyData": ""
  }
]' />
          <el-button type="primary" style="margin-top:10px" @click="importFromPaste" :loading="importLoading">解析并导入</el-button>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection, UploadFilled } from '@element-plus/icons-vue'
import api from '../api'

const route = useRoute()
const router = useRouter()
const chainCode = route.params.chainCode

const nodes = ref([])
const selectedNode = ref(null)
const activeTab = ref('basic')
const aiLoading = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const nodeStatusMap = ref({})

const importDialogVisible = ref(false)
const importTab = ref('swagger')
const importLoading = ref(false)
const swaggerUrl = ref('')
const swaggerResult = ref([])
const jsonPreview = ref([])
const curlCommand = ref('')
const pasteJson = ref('')
const jsonUploadRef = ref(null)

const sortedNodes = computed(() => {
  return [...nodes.value].sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0))
})

const loadNodes = async () => {
  const res = await api.get('/node/list', { params: { chainCode } })
  nodes.value = res.data || []
}

const selectNode = (node) => {
  selectedNode.value = { ...node }
}

const methodType = (m) => {
  const map = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger', PATCH: 'info' }
  return map[m] || 'info'
}

const formatJson = (field) => {
  try {
    const val = selectedNode.value[field]
    selectedNode.value[field] = JSON.stringify(JSON.parse(val), null, 2)
  } catch (e) {
    ElMessage.warning('JSON格式错误')
  }
}

const copyText = (text) => {
  navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

const saveNode = async () => {
  await api.post('/node/edit', selectedNode.value)
  ElMessage.success('保存成功')
  loadNodes()
}

const deleteNode = async () => {
  await api.post('/node/delete', null, { params: { id: selectedNode.value.id } })
  ElMessage.success('删除成功')
  selectedNode.value = null
  loadNodes()
}

const saveAll = async () => {
  for (const node of nodes.value) {
    await api.post('/node/edit', node)
  }
  ElMessage.success('全部保存成功')
}

const onDragStart = (e) => {
  e.dataTransfer.setData('text/plain', 'httpNode')
}

const onDrop = async () => {
  try {
    await api.post('/node/create', { chainCode, nodeName: '新节点', requestMethod: 'GET', requestUrl: 'http://' })
    await loadNodes()
  } catch (e) {
    ElMessage.error('新增失败: ' + (e.response?.data?.message || e.message))
  }
}

const addNode = async () => {
  try {
    await api.post('/node/create', { chainCode, nodeName: '新节点', requestMethod: 'GET', requestUrl: 'http://' })
    await loadNodes()
    ElMessage.success('已新增节点')
  } catch (e) {
    ElMessage.error('新增失败: ' + (e.response?.data?.message || e.message))
  }
}

const openImportDialog = () => {
  swaggerUrl.value = ''
  swaggerResult.value = []
  jsonPreview.value = []
  curlCommand.value = ''
  pasteJson.value = ''
  importDialogVisible.value = true
}

const importFromSwagger = async () => {
  if (!swaggerUrl.value) {
    ElMessage.warning('请输入Swagger URL')
    return
  }
  importLoading.value = true
  try {
    const resp = await fetch(swaggerUrl.value)
    const spec = await resp.json()
    const result = []
    const paths = spec.paths || {}
    const baseUrl = spec.servers?.[0]?.url || ''
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, detail] of Object.entries(methods)) {
        if (['get','post','put','delete','patch'].includes(method.toLowerCase())) {
          result.push({
            nodeName: detail.summary || detail.operationId || path,
            method: method.toUpperCase(),
            url: baseUrl + path,
            headers: JSON.stringify(detail.requestBody?.content?.['application/json'] ? { 'Content-Type': 'application/json' } : {}),
            bodyData: ''
          })
        }
      }
    }
    swaggerResult.value = result
    ElMessage.success(`解析到 ${result.length} 个接口`)
  } catch (e) {
    ElMessage.error('解析失败: ' + e.message)
  } finally {
    importLoading.value = false
  }
}

const confirmSwaggerImport = async () => {
  const list = swaggerResult.value.map((item, i) => ({ ...item, sort: i + 1, parallelGroup: '' }))
  await api.post('/node/import', { chainCode, interfaces: list })
  ElMessage.success(`导入 ${list.length} 个接口成功`)
  importDialogVisible.value = false
  loadNodes()
}

const handleJsonFile = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      const result = parseImportData(data)
      jsonPreview.value = result
      ElMessage.success(`解析到 ${result.length} 个接口`)
    } catch (err) {
      ElMessage.error('JSON解析失败: ' + err.message)
    }
  }
  reader.readAsText(file.raw)
}

const parseImportData = (data) => {
  if (Array.isArray(data)) {
    return data.map(item => ({
      nodeName: item.nodeName || item.name || item.title || '未命名',
      method: (item.method || 'GET').toUpperCase(),
      url: item.url || item.request?.url || '',
      headers: typeof item.headers === 'string' ? item.headers : JSON.stringify(item.headers || {}),
      bodyData: item.bodyData || item.body || item.request?.body || ''
    }))
  }
  if (data.item || data.requests) {
    const items = data.item || data.requests || []
    return items.map(item => ({
      nodeName: item.name || item.nodeName || '未命名',
      method: (item.request?.method || item.method || 'GET').toUpperCase(),
      url: item.request?.url || item.url || '',
      headers: JSON.stringify(item.request?.header || item.headers || {}),
      bodyData: item.request?.body?.raw || item.bodyData || ''
    }))
  }
  if (data.paths) {
    const result = []
    for (const [path, methods] of Object.entries(data.paths)) {
      for (const [method, detail] of Object.entries(methods)) {
        if (['get','post','put','delete','patch'].includes(method.toLowerCase())) {
          result.push({
            nodeName: detail.summary || detail.operationId || path,
            method: method.toUpperCase(),
            url: path,
            headers: '{}',
            bodyData: ''
          })
        }
      }
    }
    return result
  }
  return []
}

const confirmJsonImport = async () => {
  const list = jsonPreview.value.map((item, i) => ({ ...item, sort: i + 1, parallelGroup: '' }))
  await api.post('/node/import', { chainCode, interfaces: list })
  ElMessage.success(`导入 ${list.length} 个接口成功`)
  importDialogVisible.value = false
  loadNodes()
}

const importFromCurl = async () => {
  if (!curlCommand.value.trim()) {
    ElMessage.warning('请输入cURL命令')
    return
  }
  importLoading.value = true
  try {
    const result = parseCurl(curlCommand.value)
    await api.post('/node/import', { chainCode, interfaces: [result] })
    ElMessage.success('导入成功')
    importDialogVisible.value = false
    loadNodes()
  } catch (e) {
    ElMessage.error('解析失败: ' + e.message)
  } finally {
    importLoading.value = false
  }
}

const parseCurl = (cmd) => {
  const lines = cmd.replace(/\\\n/g, ' ').replace(/\\/g, ' ').split(/\s+/)
  let method = 'GET', url = '', headers = {}, body = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '-X' && lines[i+1]) { method = lines[++i].replace(/['"]/g, '').toUpperCase() }
    else if (t.startsWith('-H') && lines[i+1]) {
      const h = lines[++i].replace(/^['"]|['"]$/g, '')
      const [k, ...v] = h.split(':')
      if (k) headers[k.trim()] = v.join(':').trim()
    }
    else if ((t === '-d' || t === '--data') && lines[i+1]) {
      body = lines[++i].replace(/^['"]|['"]$/g, '')
      if (method === 'GET') method = 'POST'
    }
    else if (t.startsWith('http')) { url = t.replace(/['"]/g, '') }
  }
  return {
    nodeName: url ? new URL(url).pathname.split('/').filter(Boolean).pop() || 'cURL导入' : 'cURL导入',
    method,
    url,
    headers: JSON.stringify(headers),
    bodyData: body
  }
}

const importFromPaste = async () => {
  if (!pasteJson.value.trim()) {
    ElMessage.warning('请粘贴JSON数据')
    return
  }
  importLoading.value = true
  try {
    const data = JSON.parse(pasteJson.value)
    const list = (Array.isArray(data) ? data : [data]).map((item, i) => ({
      nodeName: item.nodeName || item.name || '未命名',
      method: (item.method || 'GET').toUpperCase(),
      url: item.url || '',
      headers: typeof item.headers === 'string' ? item.headers : JSON.stringify(item.headers || {}),
      bodyData: item.bodyData || item.body || '',
      sort: i + 1,
      parallelGroup: ''
    }))
    await api.post('/node/import', { chainCode, interfaces: list })
    ElMessage.success(`导入 ${list.length} 个接口成功`)
    importDialogVisible.value = false
    loadNodes()
  } catch (e) {
    ElMessage.error('JSON解析失败: ' + e.message)
  } finally {
    importLoading.value = false
  }
}

const autoLayout = () => {
  ElMessage.success('已自动布局')
}

const undo = () => ElMessage.info('撤销')
const redo = () => ElMessage.info('重做')

const generateTestData = async () => {
  if (nodes.value.length === 0) {
    ElMessage.warning('请先添加节点')
    return
  }
  aiLoading.value = true
  try {
    const res = await api.post('/ai/data/generate', { chainCode, idGenerateMode: 'AUTO_INCREMENT', idStep: 1 })
    const nodeData = res.data.nodeData
    for (const node of nodes.value) {
      if (nodeData[node.nodeCode] && nodeData[node.nodeCode].bodyData) {
        node.bodyData = nodeData[node.nodeCode].bodyData
      }
    }
    ElMessage.success('测试数据生成成功')
  } catch (e) {
    ElMessage.error('AI生成失败: ' + (e.message || '未知错误'))
  } finally {
    aiLoading.value = false
  }
}

const executeChain = async () => {
  const res = await api.post('/execute/run', { chainCode })
  const executionId = res.data.executionId
  ElMessage.success('执行已启动')
  router.push('/execute/detail/' + executionId)
}

onMounted(loadNodes)
</script>

<style scoped>
.chain-edit { height: calc(100vh - 80px); display: flex; flex-direction: column; }
.toolbar { padding: 10px; background: #fff; border-bottom: 1px solid #e4e7ed; display: flex; gap: 8px; }
.main-area { flex: 1; display: flex; overflow: hidden; }
.left-panel { width: 200px; background: #fff; border-right: 1px solid #e4e7ed; padding: 15px; }
.center-panel { flex: 1; background: #f5f7fa; overflow-y: auto; padding: 20px; position: relative; }
.right-panel { width: 400px; background: #fff; border-left: 1px solid #e4e7ed; padding: 15px; overflow-y: auto; }
.panel-title { font-weight: bold; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e4e7ed; }
.node-item { padding: 10px; border: 1px solid #dcdfe6; border-radius: 4px; cursor: grab; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.node-item:hover { border-color: #409eff; }
.empty-hint { text-align: center; color: #909399; padding: 60px; }
.node-card { background: #fff; border: 2px solid #dcdfe6; border-radius: 8px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s; }
.node-card:hover { border-color: #409eff; }
.node-card.selected { border-color: #409eff; box-shadow: 0 0 8px rgba(64,158,255,0.3); }
.node-card.status-running { border-color: #409eff; animation: pulse 1.5s infinite; }
.node-card.status-success { border-color: #67c23a; }
.node-card.status-failed { border-color: #f56c6c; }
.node-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.node-name { font-weight: bold; }
.node-url { font-size: 12px; color: #909399; word-break: break-all; }
.node-status { font-size: 12px; margin-top: 6px; }
.connection-arrow { font-size: 20px; text-align: center; color: #909399; padding: 4px 0; }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(64,158,255,0.4); } 50% { box-shadow: 0 0 0 8px rgba(64,158,255,0); } }
</style>
