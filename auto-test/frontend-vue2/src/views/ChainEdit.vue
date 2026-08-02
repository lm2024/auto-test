<template>
  <div class="chain-edit">
    <div class="toolbar">
      <div class="toolbar-left">
        <t-button @click="$router.back()" >返回</t-button>
        <t-divider layout="vertical" />
        <span class="chain-title">链路编排</span>
        <t-divider layout="vertical" />
        <t-select v-model="currentVersion" placeholder="选择版本" size="small" @change="onVersionChange" style="width: 160px" clearable>
          <t-option v-for="v in versions" :key="v.version" :label="'v' + v.version" :value="v.version" />
        </t-select>
        <div class="version-diff-summary" v-if="diffSummary">
          <span class="diff-badge diff-added">新增 {{ diffSummary.added }}</span>
          <span class="diff-badge diff-removed">删除 {{ diffSummary.removed }}</span>
          <span class="diff-badge diff-modified">修改 {{ diffSummary.modified }}</span>
          <span class="diff-badge diff-unchanged">未变 {{ diffSummary.unchanged }}</span>
        </div>
      </div>
      <div class="toolbar-right">
        <t-space>
          <t-button :theme="viewMode === 'list' ? 'primary' : 'default'" @click="viewMode = 'list'" size="small">
             列表视图
          </t-button>
          <t-button :theme="viewMode === 'trace' ? 'primary' : 'default'" @click="viewMode = 'trace'; loadTraceGroups()" size="small">
             分组视图
          </t-button>
        </t-space>
        <t-button @click="undo" :disabled="!canUndo" >撤销</t-button>
        <t-button @click="redo" :disabled="!canRedo" >重做</t-button>
        <t-button @click="autoLayout" >自动布局</t-button>
        <t-divider layout="vertical" />
        <t-button theme="warning" @click="generateTestData" :loading="aiLoading" >AI生成测试数据</t-button>
        <t-button theme="success" @click="executeChain" :disabled="nodes.length === 0" >执行</t-button>
        <t-button theme="primary" @click="saveAll" >保存</t-button>
      </div>
    </div>
    <div class="main-area">
      <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
        <div class="panel-section">
          <div class="panel-title">
            
            <span>节点库</span>
          </div>
          <div class="node-item" draggable @dragstart="onDragStart">
            <i class="el-icon-connection node-icon http" style="font-size:18px"></i>
            <div class="node-item-info">
              <span class="node-item-name">HTTP请求</span>
              <span class="node-item-desc">发送HTTP请求</span>
            </div>
          </div>
          <t-button theme="primary" variant="outline" @click="openImportDialog" style="width:100%;margin-top:12px" >批量导入</t-button>
        </div>
        <div class="panel-section" style="margin-top:16px">
          <div class="panel-title">
            
            <span>节点列表</span>
            <t-tag size="small" theme="default" style="margin-left:auto">{{ nodes.length }}</t-tag>
          </div>
          <div class="node-list">
            <div v-for="(node, index) in sortedNodes" :key="node.nodeCode"
                 class="node-list-item"
                 :class="{ active: selectedNode && selectedNode.nodeCode === node.nodeCode, ['change-' + (nodeChangeMap[node.nodeCode] || '')]: nodeChangeMap[node.nodeCode] }"
                 draggable="true"
                 @dragstart="onListDragStart($event, node.nodeCode)"
                 @dragover.prevent
                 @drop="onListDrop($event, node.nodeCode)"
                 @click="selectNode(node)">
              <i class="el-icon-rank list-drag-handle" style="font-size:14px"></i>
              <t-tag size="small" :theme="methodType(node.requestMethod)" class="method-tag">{{ node.requestMethod }}</t-tag>
              <span class="node-list-name">{{ node.nodeName || node.nodeCode }}</span>
            </div>
            <div v-if="nodes.length === 0" class="empty-list">暂无节点</div>
          </div>
        </div>
        <div class="panel-section" style="margin-top:16px" v-if="chainCode">
          <VersionHistory :chainCode="chainCode" :selectedVersion="currentVersion" @select-version="onVersionChange" />
        </div>
      </div>
      <!-- Left-Center Resizer -->
      <div class="panel-resizer left-resizer" @mousedown="startResizeLeft"></div>
      <!-- Center Panel (List View) -->
      <div class="center-panel" v-if="viewMode === 'list'">
        <div class="empty-canvas" v-if="nodes.length === 0">
          <div class="empty-icon"></div>
          <div class="empty-title">空画布</div>
          <div class="empty-desc">从左侧节点库拖入节点，或批量导入接口配置</div>
          <t-button theme="primary" @click="openImportDialog" style="margin-top:20px">批量导入</t-button>
        </div>
        <div v-for="(node, index) in sortedNodes" :key="node.nodeCode">
          <div class="node-card" :class="nodeCardClass(node)" @click="selectNode(node)">
            <div class="node-card-header">
              <div class="node-card-left">
                <span class="drag-handle"></span>
                <span class="node-index">{{ index + 1 }}</span>
                <div class="node-card-info">
                  <div class="node-card-name">{{ node.nodeName || node.nodeCode }}</div>
                  <div class="node-card-url">{{ node.requestUrl }}</div>
                </div>
              </div>
              <div class="node-card-right">
                <t-tag size="small" :theme="methodType(node.requestMethod)">{{ node.requestMethod }}</t-tag>
                <span class="status-badge" :class="'badge-' + nodeStatusMap[node.nodeCode]" v-if="nodeStatusMap[node.nodeCode]">{{ statusText(nodeStatusMap[node.nodeCode]) }}</span>
              </div>
            </div>
            <div class="node-card-file" v-if="node.interfaceFile">
              
              <span>附件: {{ node.interfaceFile }}</span>
            </div>
            <div class="node-card-data" v-if="node.triggerEvent">
              
              <span>触发事件: {{ node.triggerEvent }}</span>
            </div>
          </div>
          <div class="connection-arrow" v-if="index < sortedNodes.length - 1">
            <div class="arrow-line"></div>
            <span class="arrow-icon"></span>
          </div>
          <!-- Node change indicator -->
          <span class="change-indicator" :class="nodeChangeMap[node.nodeCode] || ''" v-if="nodeChangeMap[node.nodeCode] && nodeChangeMap[node.nodeCode] !== 'unchanged'">{{ diffLabel(nodeChangeMap[node.nodeCode]) }}</span>
        </div>
        <div class="add-node-area" v-if="nodes.length > 0">
          <t-button theme="primary" variant="outline" @click="openImportDialog" >添加节点</t-button>
        </div>
      </div>
      <!-- Left-Center Resizer (right side) -->
      <div class="panel-resizer right-resizer" @mousedown="startResizeRight"></div>
      <!-- Right Panel (Config) -->
      <div class="right-panel" :style="{ width: rightPanelWidth + 'px' }" v-if="selectedNode">
        <div class="panel-header">
          <div class="panel-title-row">
            <i class="el-icon-setting config-icon" style="font-size:14px"></i>
            <span>节点配置 - {{ selectedNode.nodeName || selectedNode.nodeCode }}</span>
          </div>
          <div>
            <t-button theme="primary" @click="moveNodeUp" :disabled="isFirstNode" size="small" >上移</t-button>
            <t-button theme="primary" @click="moveNodeDown" :disabled="isLastNode" size="small" >下移</t-button>
            <t-button theme="danger" @click="deleteSelectedNode" size="small" >删除</t-button>
            <t-button theme="primary" @click="ignoreNode" size="small" >忽略</t-button>
          </div>
        </div>
        <div class="config-tabs">
          <t-tabs v-model="activeTab">
            <t-tab-panel label="基本信息" value="basic">
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">节点编码：</div>
                  <t-input v-model="selectedNode.nodeCode" size="small" disabled style="flex:1" />
                </div>
                <div class="config-row">
                  <div class="config-label">节点名称：</div>
                  <t-input v-model="selectedNode.nodeName" size="small" style="flex:1" />
                </div>
                <div class="config-row">
                  <div class="config-label">请求方法：</div>
                  <t-select v-model="selectedNode.requestMethod" size="small" style="width: 100px">
                    <t-option v-for="m in ['GET','POST','PUT','DELETE','PATCH','HEAD','OPTIONS']" :key="m" :label="m" :value="m" />
                  </t-select>
                </div>
                <div class="config-row">
                  <div class="config-label">请求URL：</div>
                  <t-input v-model="selectedNode.requestUrl" size="small" style="flex:1" />
                </div>
              </div>
            </t-tab-panel>
            <t-tab-panel label="请求配置" value="request">
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">超时时间：</div>
                  <t-input v-model="selectedNode.requestTimeout" size="small" style="width: 100px" type="number" />
                  <span class="config-hint">毫秒（默认 30000）</span>
                </div>
                <div class="config-row">
                  <div class="config-label">自定义Header：</div>
                  <div class="config-inline" style="flex:1">
                    <t-textarea v-model="selectedNode.requestHeaders" size="small"  :autosize="{ minRows: 3, maxRows: 3 + 3 }" placeholder='{"Key":"Value"}' />
                  </div>
                </div>
                <div class="config-actions">
                  <t-button size="small" @click="formatJson('requestHeaders')">格式化</t-button>
                </div>
              </div>
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">请求Body：</div>
                  <div class="config-inline" style="flex:1">
                    <t-textarea v-model="selectedNode.bodyData" size="small"  :autosize="{ minRows: 5, maxRows: 5 + 3 }" placeholder='JSON 请求体' />
                  </div>
                </div>
                <div class="config-actions">
                  <t-button size="small" @click="formatJson('bodyData')">格式化</t-button>
                </div>
              </div>
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">附加文件：</div>
                  <t-button size="small" @click="addFile" >添加文件</t-button>
                </div>
                <div class="file-list" v-if="selectedNode.files && selectedNode.files.length">
                  <div v-for="(f, idx) in selectedNode.files" :key="idx" class="file-card">
                    <i class="el-icon-document file-icon" style="font-size:16px"></i>
                    <div class="file-detail">
                      <div class="file-name">{{ f.fileName }}</div>
                      <div class="file-size">{{ (f.fileSize || 0).toLocaleString() }} bytes</div>
                    </div>
                    <t-button size="small" theme="danger" @click="removeFile(idx)" >删除</t-button>
                  </div>
                </div>
                <div class="file-upload-area">
                  <t-upload
                    class="upload-demo"
                    
                    :request-method="uploadFile"
                    :show-upload-list="false"
                    accept=".xlsx,.xls,.csv,.json,.xml,.txt,.pdf,.png,.jpg,.jpeg,.gif,.webp"
                    
                    ref="fileUploadRef">
                    <t-button size="small" theme="primary" >选择文件</t-button>
                  </t-upload>
                  <div class="upload-tip">支持 xlsx/xls/csv/json/xml/txt/pdf/image 文件</div>
                </div>
              </div>
            </t-tab-panel>
            <t-tab-panel label="断言规则" value="assertion">
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">状态码断言：</div>
                  <t-input v-model="selectedNode.statusCode" size="small" placeholder="如 200" style="width: 100px" />
                  <span class="config-hint">等于 200</span>
                </div>
              </div>
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">Body规则：</div>
                  <t-button size="small" @click="addBodyRule" >添加规则</t-button>
                </div>
                <div class="rule-list" v-if="selectedNode.bodyRules && selectedNode.bodyRules.length">
                  <div v-for="(rule, idx) in selectedNode.bodyRules" :key="idx" class="rule-row">
                    <div class="rule-row-header">
                      <span class="rule-index">规则 {{ idx + 1 }}</span>
                      <t-button size="small" theme="danger" @click="removeBodyRule(idx)" >删除</t-button>
                    </div>
                    <div class="rule-fields">
                      <div class="rule-field">
                        <div class="rule-field-label">Path：</div>
                        <t-input v-model="rule.path" size="small" placeholder="$.key" />
                        <div class="path-examples">
                          <t-tag size="small" @click="rule.path = '$.key'">$.key</t-tag>
                          <t-tag size="small" @click="rule.path = '$.array[0]'">$.array[0]</t-tag>
                          <t-tag size="small" @click="rule.path = '$.nested.data'">$.nested.data</t-tag>
                        </div>
                      </div>
                      <div class="rule-field">
                        <div class="rule-field-label">断言类型：</div>
                        <t-select v-model="rule.assertionType" size="small">
                          <t-option v-for="t in ['EQUALS','NOT_EQUALS','CONTAINS','NOT_CONTAINS','EXISTS','NOT_EXISTS','GREATER_THAN','LESS_THAN']" :key="t" :label="t" :value="t" />
                        </t-select>
                      </div>
                      <div class="rule-field">
                        <div class="rule-field-label">预期值：</div>
                        <t-input v-model="rule.expectedValue" size="small" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </t-tab-panel>
            <t-tab-panel label="高级设置" value="advanced">
              <div class="config-section">
                <div class="config-row">
                  <div class="config-label">BizOperTraceId：</div>
                  <t-input v-model="selectedNode.bizOperTraceId" size="small" placeholder="用于 TraceId 分组" style="flex:1" />
                </div>
                <div class="config-row">
                  <div class="config-label">并行分组：</div>
                  <t-input v-model="selectedNode.parallelGroup" size="small" placeholder="空表示串行" style="flex:1" />
                </div>
                <div class="config-row">
                  <div class="config-label">忽略节点：</div>
                  <t-switch v-model="selectedNode.isIgnored" size="small" />
                </div>
              </div>
              <div class="config-section" v-if="chainCode">
                <div class="config-label"> 版本 Diff 结果</div>
                <div v-if="getNodeDiffType(selectedNode)">
                  <t-tag :theme="diffTagType(getNodeDiffType(selectedNode))">{{ diffLabel(getNodeDiffType(selectedNode)) }}</t-tag>
                </div>
                <div class="field-diff-list" v-if="getNodeFieldChanges(selectedNode).length">
                  <FieldDiff :changes="getNodeFieldChanges(selectedNode)" />
                </div>
              </div>
            </t-tab-panel>
          </t-tabs>
        </div>
        <div class="panel-footer">
          <t-button @click="cancelEdit" size="small">取消</t-button>
          <t-button theme="primary" @click="saveNode" size="small">保存节点</t-button>
        </div>
      </div>
      <div class="right-panel empty-right" v-else>
        <div class="empty-config">
          <div class="empty-config-icon"></div>
          <div class="empty-config-title">未选择节点</div>
          <div class="empty-config-desc">点击左侧节点查看详情或编辑配置</div>
        </div>
      </div>
      <!-- 右侧面板折叠按钮 -->
      <div class="right-panel-collapse" v-if="rightPanelMinimized" @click="rightPanelMinimized = false">
        
      </div>
      <!-- Import Dialog -->
      <t-dialog header="批量导入接口" :visible="importDialogVisible" @update:visible="val => importDialogVisible = val" :width="800" :close-on-overlay-click="false">
        <t-tabs v-model="importTab">
          <t-tab-panel label="Swagger" value="swagger">
            <t-form>
              <t-form-item label="Swagger URL">
                <t-input v-model="swaggerUrl" placeholder="https://api.example.com/swagger.json" />
              </t-form-item>
              <t-form-item>
                <t-button theme="primary" @click="fetchSwagger" :loading="importLoading">导入</t-button>
              </t-form-item>
            </t-form>
            <div v-if="swaggerResult.length" class="json-preview">
              <h4>预览</h4>
              <pre>{{ JSON.stringify(swaggerResult, null, 2) }}</pre>
            </div>
          </t-tab-panel>
          <t-tab-panel label="JSON 导入" value="json">
            <t-textarea v-model="jsonPreviewText"  :autosize="{ minRows: 10, maxRows: 10 + 3 }" placeholder='[{"nodeName":"...", "method":"GET", ...}]' />
            <t-button theme="primary" @click="confirmJsonImport" style="margin-top:10px">确认导入</t-button>
          </t-tab-panel>
          <t-tab-panel label="cURL" value="curl">
            <t-textarea v-model="curlCommand"  :autosize="{ minRows: 5, maxRows: 5 + 3 }" placeholder="curl -X POST -H 'Content-Type: application/json' -d '{\"key\":\"value\"}' https://api.example.com/endpoint" />
            <t-button theme="primary" @click="importFromCurl" style="margin-top:10px">解析并导入</t-button>
          </t-tab-panel>
          <t-tab-panel label="粘贴 JSON" value="paste">
            <t-textarea v-model="pasteJson"  :autosize="{ minRows: 10, maxRows: 10 + 3 }" placeholder='[{"nodeName":"...", "method":"GET", ...}]' />
            <t-button theme="primary" @click="importFromPaste" style="margin-top:10px">确认导入</t-button>
          </t-tab-panel>
        </t-tabs>
        <template #footer>
          <t-button @click="importDialogVisible = false">取消</t-button>
        </template>
      </t-dialog>
    </div>
  </div>
</template>

<script>
import api from '../api'
import FieldDiff from '../components/FieldDiff.vue'
import VersionHistory from '../components/VersionHistory.vue'

export default {
  name: 'ChainEdit',
  components: {
    FieldDiff,
    VersionHistory
  },
  props: {
    // Could be used if this component is shared
  },
  data() {
    return {
      chainCode: '',
      nodes: [],
      selectedNode: null,
      activeTab: 'basic',
      aiLoading: false,
      canUndo: false,
      canRedo: false,

      // Panel resize
      leftPanelWidth: 260,
      rightPanelWidth: 440,
      isResizingLeft: false,
      isResizingRight: false,
      startX: 0,
      startWidth: 0,

      nodeStatusMap: {},
      dragIndex: null,
      dragOverIndex: null,
      viewMode: 'list',
      traceGroups: [],

      // Import dialog
      importDialogVisible: false,
      importTab: 'swagger',
      importLoading: false,
      swaggerUrl: '',
      swaggerResult: [],
      jsonPreview: [],
      curlCommand: '',
      pasteJson: '',
      jsonPreviewText: '',

      // Assertion form data
      extractRuleList: [],
      assertStatusMode: 'eq',
      assertStatusCode: '',
      assertBodyRules: [],

      // Version management
      versions: [],
      currentVersion: 0,
      diffSummary: null,
      diffData: null,

      rightPanelMinimized: false,
      fieldDiff: FieldDiff,
      versionHistory: VersionHistory
    }
  },
  computed: {
    sortedNodes() {
      return [...this.nodes].sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0))
    },
    selectedNodeIndex() {
      if (!this.selectedNode) return -1
      return this.sortedNodes.findIndex(n => n.nodeCode === this.selectedNode.nodeCode)
    },
    nodeChangeMap() {
      if (!this.diffData || !this.diffData.nodes) return {}
      const map = {}
      this.diffData.nodes.forEach(n => {
        if (n.changeType && n.changeType !== 'UNCHANGED') {
          map[n.nodeCode] = n.changeType.toLowerCase()
        }
      })
      return map
    },
    isFirstNode() {
      return this.selectedNodeIndex <= 0
    },
    isLastNode() {
      return this.selectedNodeIndex >= this.sortedNodes.length - 1
    }
  },
  mounted() {
    this.chainCode = this.$route.params.chainCode
    this.loadNodes()
    this.loadVersions()
  },
  methods: {
    // Panel resize
    startResizeLeft(e) {
      this.isResizingLeft = true
      this.startX = e.clientX
      this.startWidth = this.leftPanelWidth
      document.addEventListener('mousemove', this.onResizeLeft)
      document.addEventListener('mouseup', this.stopResizeLeft)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    onResizeLeft(e) {
      if (!this.isResizingLeft) return
      const diff = e.clientX - this.startX
      const newWidth = Math.min(Math.max(this.startWidth + diff, 200), 400)
      this.leftPanelWidth = newWidth
    },
    stopResizeLeft() {
      this.isResizingLeft = false
      document.removeEventListener('mousemove', this.onResizeLeft)
      document.removeEventListener('mouseup', this.stopResizeLeft)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
    startResizeRight(e) {
      this.isResizingRight = true
      this.startX = e.clientX
      this.startWidth = this.rightPanelWidth
      document.addEventListener('mousemove', this.onResizeRight)
      document.addEventListener('mouseup', this.stopResizeRight)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    onResizeRight(e) {
      if (!this.isResizingRight) return
      const diff = this.startX - e.clientX
      const newWidth = Math.min(Math.max(this.startWidth + diff, 300), 600)
      this.rightPanelWidth = newWidth
    },
    stopResizeRight() {
      this.isResizingRight = false
      document.removeEventListener('mousemove', this.onResizeRight)
      document.removeEventListener('mouseup', this.stopResizeRight)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },

    // Node operations
    moveNodeUp() {
      const idx = this.selectedNodeIndex
      if (idx <= 0) return
      const sorted = this.sortedNodes
      const cur = sorted[idx]
      const prev = sorted[idx - 1]
      const tmpSort = cur.sortNo
      cur.sortNo = prev.sortNo
      prev.sortNo = tmpSort
      const ci = this.nodes.findIndex(n => n.nodeCode === cur.nodeCode)
      const pi = this.nodes.findIndex(n => n.nodeCode === prev.nodeCode)
      if (ci !== -1) this.nodes[ci] = { ...cur }
      if (pi !== -1) this.nodes[pi] = { ...prev }
      this.saveAll()
    },
    moveNodeDown() {
      const idx = this.selectedNodeIndex
      if (idx < 0 || idx >= this.sortedNodes.length - 1) return
      const sorted = this.sortedNodes
      const cur = sorted[idx]
      const next = sorted[idx + 1]
      const tmpSort = cur.sortNo
      cur.sortNo = next.sortNo
      next.sortNo = tmpSort
      const ci = this.nodes.findIndex(n => n.nodeCode === cur.nodeCode)
      const ni = this.nodes.findIndex(n => n.nodeCode === next.nodeCode)
      if (ci !== -1) this.nodes[ci] = { ...cur }
      if (ni !== -1) this.nodes[ni] = { ...next }
      this.saveAll()
    },
    onDragStart(e) {
      const node = {
        nodeCode: 'node_' + Date.now(),
        nodeName: 'HTTP请求_' + this.nodes.length,
        requestMethod: 'GET',
        requestUrl: '',
        requestHeaders: '{}',
        bodyData: ''
      }
      node.sortNo = this.nodes.length
      this.nodes.push(node)
    },
    onListDragStart(e, nodeCode) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', nodeCode)
    },
    onListDrop(e, targetCode) {
      e.preventDefault()
      const sourceCode = e.dataTransfer.getData('text/plain')
      if (!sourceCode || sourceCode === targetCode) return
      const sorted = this.sortedNodes
      const sourceIdx = sorted.findIndex(n => n.nodeCode === sourceCode)
      const targetIdx = sorted.findIndex(n => n.nodeCode === targetCode)
      if (sourceIdx === -1 || targetIdx === -1) return
      const newSortNo = sorted[targetIdx].sortNo || 0
      const sourceNode = this.nodes.find(n => n.nodeCode === sourceCode)
      if (sourceNode) {
        sourceNode.sortNo = newSortNo
        const idx = this.nodes.findIndex(n => n.nodeCode === sourceCode)
        this.nodes[idx] = { ...sourceNode }
        this.saveAll()
      }
    },
    onNodeDragStart(e, index) {
      this.dragIndex = index
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', index)
      e.target.style.opacity = '0.4'
    },
    onNodeDragEnd(e) {
      e.target.style.opacity = '1'
      this.dragIndex = null
      this.dragOverIndex = null
    },
    onNodeDragOver(e, index) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      this.dragOverIndex = index
    },
    onNodeDragLeave() {
      this.dragOverIndex = null
    },
    onNodeDrop(e, dropIndex) {
      e.preventDefault()
      this.dragOverIndex = null
      const fromIndex = this.dragIndex
      if (fromIndex === null || fromIndex === dropIndex) return
      const sorted = this.sortedNodes
      const fromNode = sorted[fromIndex]
      const toNode = sorted[dropIndex]
      if (!fromNode || !toNode) return
      const fromSortNo = fromNode.sortNo || 0
      const toSortNo = toNode.sortNo || 0
      fromNode.sortNo = toSortNo
      toNode.sortNo = fromSortNo
      const fromIdx = this.nodes.findIndex(n => n.nodeCode === fromNode.nodeCode)
      const toIdx = this.nodes.findIndex(n => n.nodeCode === toNode.nodeCode)
      if (fromIdx !== -1) this.nodes[fromIdx] = { ...fromNode }
      if (toIdx !== -1) this.nodes[toIdx] = { ...toNode }
      this.saveAll()
      this.dragIndex = null
    },

    // Data loading
    async loadNodes() {
      const res = await api.get('/node/list', { params: { chainCode: this.chainCode } })
      this.nodes = res.data || []
    },
    async saveAll() {
      const sorted = this.sortedNodes
      for (const node of sorted) {
        const data = { ...node }
        delete data._uploadedFile
        await api.post('/node/edit', data)
      }
      this.$message.success('保存成功')
      this.loadNodes()
    },
    selectNode(node) {
      const n = Object.assign({}, node)
      n.files = node.files || []
      n.bodyRules = node.bodyRules || []
      this.selectedNode = n
    },
    deleteSelectedNode() {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定要删除此节点吗？',
        onConfirm: async function() {
          await api.delete('/node/delete', { params: { id: self.selectedNode.id } })
          self.$message.success('删除成功')
          self.loadNodes()
          self.selectedNode = null
        }
      })
    },
    ignoreNode() {
      this.selectedNode.isIgnored = !this.selectedNode.isIgnored
      this.saveAll()
    },
    addFile() {
      if (!this.selectedNode.files) this.selectedNode.files = []
      this.selectedNode.files.push({ fileName: '新文件', fileSize: 0 })
    },
    removeFile(idx) {
      this.selectedNode.files.splice(idx, 1)
    },
    uploadFile(context) {
      const rawFile = (context && context.file && (context.file.raw || context.file)) || context
      const formData = new FormData()
      formData.append('file', rawFile)
      formData.append('nodeCode', this.selectedNode.nodeCode)
      api.post('/upload/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => {
        this.$message.success('文件上传成功')
        this.loadNodes()
        if (context && context.onSuccess) context.onSuccess({})
      }).catch(() => {
        if (context && context.onFail) context.onFail({})
      })
    },
    onFileUploadSuccess(response) {
      if (response.code === 200) {
        this.loadNodes()
      }
    },
    addBodyRule() {
      if (!this.selectedNode.bodyRules) this.selectedNode.bodyRules = []
      this.selectedNode.bodyRules.push({ path: '', assertionType: 'EQUALS', expectedValue: '' })
    },
    removeBodyRule(idx) {
      this.selectedNode.bodyRules.splice(idx, 1)
    },
    saveNode() {
      this.saveAll()
    },
    cancelEdit() {
      this.selectedNode = null
    },
    methodType(method) {
      const types = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger', PATCH: 'info', HEAD: '', OPTIONS: '' }
      return types[method] || 'info'
    },
    statusText(status) {
      const text = { success: '成功', failed: '失败', running: '运行中' }
      return text[status] || status
    },
    nodeCardClass(node) {
      const classes = []
      if (this.selectedNode && this.selectedNode.nodeCode === node.nodeCode) {
        classes.push('selected')
      }
      const status = this.nodeStatusMap[node.nodeCode]
      if (status) {
        classes.push('status-' + status)
      }
      const change = this.nodeChangeMap[node.nodeCode]
      if (change) {
        classes.push('change-' + change)
      }
      return classes
    },
    // Import dialog
    openImportDialog() {
      this.importDialogVisible = true
      this.importTab = 'swagger'
      this.swaggerUrl = ''
      this.swaggerResult = []
      this.jsonPreview = []
      this.curlCommand = ''
      this.pasteJson = ''
    },
    async fetchSwagger() {
      this.importLoading = true
      try {
        const res = await api.get('/node/swagger/parse', { params: { url: this.swaggerUrl } })
        this.swaggerResult = res.data || []
      } catch (e) {
        this.$message.error('Swagger 解析服务未配置或不可用')
      } finally {
        this.importLoading = false
      }
    },
    parseCurl(cmd) {
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
        method, url, headers: JSON.stringify(headers), bodyData: body
      }
    },
    async importFromCurl() {
      if (!this.curlCommand.trim()) {
        this.$message.warning('请输入cURL命令')
        return
      }
      try {
        const result = this.parseCurl(this.curlCommand)
        await api.post('/node/import', { chainCode: this.chainCode, interfaces: [result] })
        this.$message.success('导入成功')
        this.loadNodes()
      } finally {}
    },
    async importFromPaste() {
      if (!this.pasteJson.trim()) {
        this.$message.warning('请粘贴JSON数据')
        return
      }
      try {
        const data = JSON.parse(this.pasteJson)
        const list = (Array.isArray(data) ? data : [data]).map((item, i) => ({
          nodeName: item.nodeName || item.name || '未命名',
          method: (item.method || 'GET').toUpperCase(),
          url: item.url || '',
          headers: typeof item.headers === 'string' ? item.headers : JSON.stringify(item.headers || {}),
          bodyData: item.bodyData || item.body || '',
          sort: i + 1,
          parallelGroup: ''
        }))
        await api.post('/node/import', { chainCode: this.chainCode, interfaces: list })
        this.$message.success(`导入 ${list.length} 个接口成功`)
        this.loadNodes()
      } finally {}
    },
    async confirmJsonImport() {
      const list = this.jsonPreview.map((item, i) => ({ ...item, sort: i + 1, parallelGroup: '' }))
      await api.post('/node/import', { chainCode: this.chainCode, interfaces: list })
      this.$message.success(`导入 ${list.length} 个接口成功`)
      this.loadNodes()
    },
    formatJson(key) {
      try {
        const obj = JSON.parse(this.selectedNode[key])
        this.selectedNode[key] = JSON.stringify(obj, null, 2)
        this.$message.success('格式化成功')
      } catch (e) {
        this.$message.error('无效的 JSON: ' + e.message)
      }
    },
    autoLayout() {
      this.sortedNodes.forEach((node, i) => {
        node.sortNo = i
      })
      this.saveAll()
    },
    undo() {
      this.$message.info('撤销')
    },
    redo() {
      this.$message.info('重做')
    },
    async generateTestData() {
      if (this.nodes.length === 0) {
        this.$message.warning('请先添加节点')
        return
      }
      this.aiLoading = true
      try {
        const res = await api.post('/ai/data/generate', { chainCode: this.chainCode, idGenerateMode: 'AUTO_INCREMENT', idStep: 1 })
        const nodeData = res.data.nodeData
        const message = res.data.message || '测试数据生成成功'
        let updatedCount = 0
        for (const node of this.nodes) {
          if (nodeData[node.nodeCode] && nodeData[node.nodeCode].bodyData) {
            node.bodyData = nodeData[node.nodeCode].bodyData
            updatedCount++
          }
        }
        if (updatedCount > 0) {
          await this.saveAll()
          this.$message.success(`${message}，已写入 ${updatedCount} 个节点的请求体，请在右侧「请求配置」中查看`)
        } else {
          this.$message.warning('未生成到有效数据，请检查节点是否配置了请求URL')
        }
      } catch (e) {
        this.$message.error('AI生成失败: ' + (e.message || '未知错误'))
      } finally {
        this.aiLoading = false
      }
    },
    async executeChain() {
      const res = await api.post('/execute/run', { chainCode: this.chainCode })
      const executionId = res.data.executionId
      this.$message.success('执行已启动')
      this.$router.push('/execute/detail/' + executionId)
    },

    // Version management
    async loadVersions() {
      try {
        const res = await api.get('/chain/versions', { params: { chainCode: this.chainCode, all: 'false' } })
        if (res.code === 200) {
          this.versions = (res.data && res.data.list) || []
          if (this.versions.length > 0 && !this.currentVersion) {
            this.currentVersion = this.versions[0].version
          }
        }
      } catch (e) {
        console.error('加载版本列表失败:', e)
      }
    },
    async onVersionChange(version) {
      if (!version) {
        this.diffSummary = null
        this.diffData = null
        return
      }
      try {
        const res = await api.get('/chain/version/diff', { params: { chainCode: this.chainCode, version: version } })
        if (res.code === 200) {
          this.diffData = res.data
          this.diffSummary = (res.data && res.data.summary) || null
        }
      } catch (e) {
        console.error('加载Diff失败:', e)
      }
    },
    getNodeDiffType(node) {
      if (!this.diffData || !this.diffData.nodes || !node) return null
      const found = this.diffData.nodes.find(n => n.nodeCode === node.nodeCode)
      return found ? found.changeType : null
    },
    getNodeFieldChanges(node) {
      if (!this.diffData || !this.diffData.nodes || !node) return []
      const found = this.diffData.nodes.find(n => n.nodeCode === node.nodeCode)
      return found && found.fieldChanges ? found.fieldChanges : []
    },
    diffTagType(type) {
      if (type === 'ADDED') return 'success'
      if (type === 'REMOVED') return 'danger'
      if (type === 'MODIFIED') return 'warning'
      return 'info'
    },
    diffLabel(type) {
      if (type === 'ADDED') return '新增'
      if (type === 'REMOVED') return '已删除'
      if (type === 'MODIFIED') return '已修改'
      if (type === 'UNCHANGED') return '未变化'
      return type
    },
    async loadTraceGroups() {
      try {
        const res = await api.get('/chain/trace-groups', { params: { chainCode: this.chainCode } })
        if (res.code === 200) {
          this.traceGroups = res.data || []
        }
      } catch (e) {
        this.traceGroups = []
      }
    }
  }
}
</script>

<style scoped>
.chain-edit {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f9fc;
  color: #1a1a1a;
  font-family: 'Inter', 'SF Pro Display', -apple-system, sans-serif;
}

.toolbar {
  padding: 14px 20px;
  background: var(--sb-surface);
  border-bottom: 1px solid rgba(62, 207, 142, 0.08);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-left { display: flex; align-items: center; gap: 8px; }
.toolbar-right { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.chain-title { font-size: 16px; font-weight: 600; color: #1a1a1a; }

/* Toolbar Buttons */
.toolbar ::v-deep(.el-button) {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}
.toolbar ::v-deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(62, 207, 142, 0.15);
}
.toolbar ::v-deep(.el-button-group .el-button:not(:first-child):not(:last-child)) {
  border-radius: 10px;
}
.toolbar ::v-deep(.el-button-group .el-button:first-child) {
  border-radius: 10px 0 0 10px;
}
.toolbar ::v-deep(.el-button-group .el-button:last-child) {
  border-radius: 0 10px 10px 0;
}
.toolbar ::v-deep(.el-button .el-icon) {
  margin-right: 4px;
}

.version-diff-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 6px;
}
.diff-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.diff-badge.diff-added { background: #e6f7ee; color: #16a34a; }
.diff-badge.diff-removed { background: #fee2e2; color: #dc2626; }
.diff-badge.diff-modified { background: #fef3c7; color: #d97706; }
.diff-badge.diff-unchanged { background: #f3f4f6; color: #6b7280; }

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left Panel */
.left-panel {
  width: 260px;
  min-width: 200px;
  max-width: 400px;
  background: var(--sb-surface);
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  flex-shrink: 0;
  padding: 16px;
}
.panel-section { margin-bottom: 12px; }
.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sb-text);
  margin-bottom: 10px;
}
.panel-title .el-icon { font-size: 14px; }

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;
}
.node-item:hover {
  border-color: #3ecf8e;
  background: #f0fdf4;
}
.node-item:active { cursor: grabbing; }
.node-item-info { flex: 1; }
.node-item-name { font-size: 13px; font-weight: 500; color: #1a1a1a; }
.node-item-desc { font-size: 11px; color: #6b7280; margin-top: 2px; }
.node-icon.http { color: #3ecf8e; }

.node-list {
  max-height: 240px;
  overflow-y: auto;
}
.node-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
}
.node-list-item:hover { background: #f3f4f6; }
.node-list-item.active {
  background: #e0f2fe;
  border-left: 3px solid #0ea5e9;
}
.node-list-item.change-added { border-left: 3px solid #16a34a; background: #f0fdf4; }
.node-list-item.change-removed { border-left: 3px solid #dc2626; background: #fee2e2; }
.node-list-item.change-modified { border-left: 3px solid #d97706; background: #fef3c7; }
.list-drag-handle { color: #9ca3af; cursor: grab; font-size: 14px; }
.method-tag { font-weight: 500; }
.node-list-name { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-list { text-align: center; padding: 20px; color: #9ca3af; font-size: 13px; }

/* Resizer */
.panel-resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 1;
}
.panel-resizer:hover, .panel-resizer:active { background: #3ecf8e; }
.left-resizer { margin-left: -3px; }
.right-resizer { margin-right: -3px; }

/* Center Panel */
.center-panel {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f7f9fc;
}
.empty-canvas {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}
.empty-icon .el-icon { color: #d1d5db; }
.empty-title { font-size: 18px; font-weight: 600; margin-top: 12px; color: #4b5563; }
.empty-desc { font-size: 13px; margin-top: 6px; }

/* Node Cards */
.node-card {
  background: var(--sb-surface);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.node-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border-color: #3ecf8e;
}
.node-card.selected {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
}
.node-card.status-success { border-left: 4px solid #16a34a; }
.node-card.status-failed { border-left: 4px solid #dc2626; }
.node-card.status-running { border-left: 4px solid #d97706; }
.node-card.change-added { border-left: 4px solid #16a34a; background: #f0fdf4; }
.node-card.change-removed { border-left: 4px solid #dc2626; background: #fee2e2; }
.node-card.change-modified { border-left: 4px solid #d97706; background: #fef3c7; }

.node-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.node-card-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.drag-handle { color: #9ca3af; cursor: grab; font-size: 16px; }
.node-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #f3f4f6;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}
.node-card-info { flex: 1; min-width: 0; }
.node-card-name { font-size: 13px; font-weight: 500; color: #1a1a1a; }
.node-card-url {
  font-size: 11px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.node-card-right { display: flex; align-items: center; gap: 6px; }
.status-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.status-badge.badge-success { background: #e6f7ee; color: #16a34a; }
.status-badge.badge-failed { background: #fee2e2; color: #dc2626; }
.status-badge.badge-running { background: #fef3c7; color: #d97706; }

.node-card-file, .node-card-data {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
}
.node-card-file .el-icon, .node-card-data .el-icon { font-size: 14px; }

.connection-arrow {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 32px;
}
.arrow-line {
  width: 2px;
  height: 20px;
  background: #d1d5db;
  margin: 0 auto;
}
.arrow-icon { color: #9ca3af; font-size: 14px; }

.add-node-area {
  text-align: center;
  padding: 20px;
}
.change-indicator {
  position: absolute;
  right: 12px;
  top: 12px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.change-indicator.added { background: #e6f7ee; color: #16a34a; }
.change-indicator.removed { background: #fee2e2; color: #dc2626; }
.change-indicator.modified { background: #fef3c7; color: #d97706; }

/* Right Panel */
.right-panel {
  width: 440px;
  min-width: 300px;
  max-width: 600px;
  background: var(--sb-surface);
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
}
.right-panel.empty-right {
  width: 300px;
  min-width: 300px;
  max-width: 300px;
}
.panel-header {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.panel-title-row { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.config-icon { font-size: 14px; }
.panel-title-row span { font-size: 13px; font-weight: 600; color: var(--sb-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.config-tabs { flex: 1; padding: 0; }
.config-tabs ::v-deep(.el-tabs__content) {
  padding: 16px;
}
.config-section { margin-bottom: 16px; }
.config-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.config-label {
  font-size: 12px;
  font-weight: 500;
  color: #4b5563;
  white-space: nowrap;
  min-width: 90px;
}
.config-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-left: 8px;
}
.config-inline { flex: 1; }
.config-actions { margin-top: 8px; }

.file-list { margin-top: 8px; }
.file-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 12px;
}
.file-icon { color: #6b7280; }
.file-name { font-weight: 500; }
.file-size { font-size: 11px; color: #9ca3af; }

.file-upload-area { margin-top: 12px; }
.upload-tip { font-size: 11px; color: #9ca3af; margin-top: 4px; }

.rule-list { margin-top: 8px; }
.rule-row {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  font-size: 12px;
}
.rule-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.rule-index { font-weight: 600; color: var(--sb-text); }
.rule-fields { display: flex; flex-direction: column; gap: 8px; }
.rule-field { display: flex; align-items: flex-start; gap: 8px; }
.rule-field-label {
  font-size: 11px;
  font-weight: 500;
  color: #4b5563;
  white-space: nowrap;
  min-width: 50px;
}
.path-examples {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Empty Right */
.empty-config {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}
.empty-config-icon .el-icon { color: #d1d5db; }
.empty-config-title { font-size: 15px; font-weight: 600; color: #4b5563; margin-top: 10px; }
.empty-config-desc { font-size: 12px; margin-top: 4px; }

/* Right Panel Collapse */
.right-panel-collapse {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 60px;
  background: var(--sb-surface);
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 8px 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  z-index: 10;
  transition: all 0.2s;
}
.right-panel-collapse:hover { background: #f3f4f6; color: #3ecf8e; }

/* Version History */
.version-history { margin-top: 16px; }

/* JSON Preview */
.json-preview {
  margin-top: 16px;
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}
.json-preview h4 { color: #e2e8f0; margin: 0 0 8px; font-size: 13px; }
.json-preview pre {
  color: #a5b4fc;
  font-size: 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Scrollbar */
.chain-edit ::-webkit-scrollbar { width: 6px; }
.chain-edit ::-webkit-scrollbar-track { background: transparent; }
.chain-edit ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.chain-edit ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

/* Responsive */
@media (max-width: 768px) {
  .toolbar { padding: 10px 12px; gap: 6px; }
  .toolbar-left, .toolbar-right { flex-wrap: wrap; }
  .left-panel { width: 200px; min-width: 180px; }
  .right-panel { width: 300px; min-width: 260px; }
}
</style>
