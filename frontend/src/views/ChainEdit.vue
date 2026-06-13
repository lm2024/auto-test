<template>
  <div class="chain-edit">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button @click="$router.back()" :icon="ArrowLeft">返回</el-button>
        <el-divider direction="vertical" />
        <span class="chain-title">链路编排</span>
      </div>
      <div class="toolbar-right">
        <el-button @click="undo" :disabled="!canUndo" :icon="RefreshLeft">撤销</el-button>
        <el-button @click="redo" :disabled="!canRedo" :icon="RefreshRight">重做</el-button>
        <el-button @click="autoLayout" :icon="Grid">自动布局</el-button>
        <el-divider direction="vertical" />
        <el-button type="warning" @click="generateTestData" :loading="aiLoading" :icon="MagicStick">AI生成测试数据</el-button>
        <el-button type="success" @click="executeChain" :disabled="nodes.length === 0" :icon="CaretRight">执行</el-button>
        <el-button type="primary" @click="saveAll" :icon="Check">保存</el-button>
      </div>
    </div>

    <div class="main-area">
      <div class="left-panel">
        <div class="panel-section">
          <div class="panel-title">
            <el-icon><Box /></el-icon>
            <span>节点库</span>
          </div>
          <div class="node-item" draggable @dragstart="onDragStart">
            <el-icon class="node-icon http"><Connection /></el-icon>
            <div class="node-item-info">
              <span class="node-item-name">HTTP请求</span>
              <span class="node-item-desc">发送HTTP请求</span>
            </div>
          </div>
          <el-button type="primary" plain @click="openImportDialog" style="width:100%;margin-top:12px" :icon="Upload">
            批量导入
          </el-button>
        </div>

        <div class="panel-section" style="margin-top:16px">
          <div class="panel-title">
            <el-icon><List /></el-icon>
            <span>节点列表</span>
            <el-tag size="small" type="info" style="margin-left:auto">{{ nodes.length }}</el-tag>
          </div>
          <div class="node-list">
            <div v-for="(node, index) in sortedNodes" :key="node.nodeCode"
                 class="node-list-item"
                 :class="{ active: selectedNode?.nodeCode === node.nodeCode }"
                 draggable="true"
                 @dragstart="onListDragStart($event, node.nodeCode)"
                 @dragover.prevent
                 @drop="onListDrop($event, node.nodeCode)"
                 @click="selectNode(node)">
              <el-icon class="list-drag-handle"><Rank /></el-icon>
              <el-tag size="small" :type="methodType(node.requestMethod)" class="method-tag">{{ node.requestMethod }}</el-tag>
              <span class="node-list-name">{{ node.nodeName || node.nodeCode }}</span>
            </div>
            <div v-if="nodes.length === 0" class="empty-list">暂无节点</div>
          </div>
        </div>
      </div>

      <div class="center-panel" ref="canvasRef" @dragover.prevent>
        <div v-if="nodes.length === 0" class="empty-canvas" @drop="onDrop" @dragover.prevent>
          <el-icon class="empty-icon"><Connection /></el-icon>
          <div class="empty-title">拖拽节点到此处</div>
          <div class="empty-desc">或点击左侧「批量导入」添加接口</div>
        </div>
        <template v-for="(node, index) in sortedNodes" :key="node.nodeCode">
          <div class="node-card"
               :class="{ selected: selectedNode?.nodeCode === node.nodeCode, ['status-' + (nodeStatusMap[node.nodeCode] || '').toLowerCase()]: true, 'drag-over': dragOverIndex === index }"
               draggable="true"
               @dragstart="onNodeDragStart($event, index)"
               @dragend="onNodeDragEnd"
               @dragover="onNodeDragOver($event, index)"
               @dragleave="onNodeDragLeave"
               @drop="onNodeDrop($event, index)"
               @click="selectNode(node)">
            <div class="node-card-header">
              <div class="node-card-left">
                <el-icon class="drag-handle"><Rank /></el-icon>
                <div class="node-index">{{ index + 1 }}</div>
                <div class="node-card-info">
                  <div class="node-card-name">{{ node.nodeName || node.nodeCode }}</div>
                  <div class="node-card-url">{{ node.requestUrl }}</div>
                </div>
              </div>
              <div class="node-card-right">
                <el-tag size="small" :type="methodType(node.requestMethod)" effect="dark">{{ node.requestMethod }}</el-tag>
                <div v-if="nodeStatusMap[node.nodeCode]" class="status-badge" :class="'badge-' + nodeStatusMap[node.nodeCode].toLowerCase()">
                  {{ nodeStatusMap[node.nodeCode] }}
                </div>
              </div>
            </div>
            <div v-if="node.bodyType === 'file'" class="node-card-file">
              <el-icon><Document /></el-icon>
              <span>文件上传</span>
            </div>
            <div v-if="node.bodyData" class="node-card-data">
              <el-icon><Document /></el-icon>
              <span>已填充测试数据</span>
            </div>
          </div>
          <div v-if="index < sortedNodes.length - 1" class="connection-arrow">
            <div class="arrow-line"></div>
            <el-icon class="arrow-icon"><Bottom /></el-icon>
          </div>
        </template>
        <div v-if="nodes.length > 0" class="add-node-area" @drop.stop="onDrop" @dragover.prevent>
          <el-button type="primary" plain @click="addNode" :icon="Plus">新增节点</el-button>
        </div>
      </div>

      <transition name="slide-right">
        <div class="right-panel" v-if="selectedNode">
          <div class="panel-header">
            <div class="panel-title-row">
              <el-icon class="config-icon"><Setting /></el-icon>
              <span>属性配置</span>
            </div>
            <el-button text @click="selectedNode = null" :icon="Close" />
          </div>

          <el-tabs v-model="activeTab" class="config-tabs">
            <el-tab-pane label="基础信息" name="basic">
              <div class="config-section">
                <div class="config-label">节点名称</div>
                <el-input v-model="selectedNode.nodeName" placeholder="请输入节点名称" clearable />
              </div>
              <div class="config-row">
                <div class="config-label">排序号</div>
                <el-input-number v-model="selectedNode.sortNo" :min="1" size="small" />
              </div>
              <div class="config-row">
                <div class="config-label">并行分组</div>
                <el-input v-model="selectedNode.parallelGroup" placeholder="为空则串行" size="small" clearable />
              </div>
              <div class="config-row">
                <div class="config-label">等待时间</div>
                <div class="config-inline">
                  <el-input-number v-model="selectedNode.delaySeconds" :min="0" :max="3600" size="small" />
                  <span class="config-hint">秒，执行后等待再执行下一节点</span>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="请求配置" name="request">
              <div class="config-section">
                <div class="config-label">请求方法</div>
                <el-select v-model="selectedNode.requestMethod" style="width:100%">
                  <el-option label="GET" value="GET" />
                  <el-option label="POST" value="POST" />
                  <el-option label="PUT" value="PUT" />
                  <el-option label="DELETE" value="DELETE" />
                  <el-option label="PATCH" value="PATCH" />
                </el-select>
              </div>
              <div class="config-section">
                <div class="config-label">URL</div>
                <el-input v-model="selectedNode.requestUrl" placeholder="https://api.example.com/endpoint" clearable />
              </div>
              <div class="config-section">
                <div class="config-label">
                  请求体类型
                  <el-tooltip content="JSON: 发送JSON数据 | 文件: 上传文件(Multipart)" placement="top">
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <el-radio-group v-model="selectedNode.bodyType" size="small">
                  <el-radio-button label="json">JSON</el-radio-button>
                  <el-radio-button label="file">文件上传</el-radio-button>
                  <el-radio-button label="form">Form Data</el-radio-button>
                </el-radio-group>
              </div>

              <template v-if="selectedNode.bodyType === 'json'">
                <div class="config-section">
                  <div class="config-label">请求头</div>
                  <el-input v-model="selectedNode.requestHeaders" type="textarea" :rows="3"
                    placeholder='{"Content-Type":"application/json"}' />
                  <div class="config-actions">
                    <el-button size="small" text @click="formatJson('requestHeaders')">格式化</el-button>
                    <el-button size="small" text @click="copyText(selectedNode.requestHeaders)">复制</el-button>
                  </div>
                </div>
                <div class="config-section">
                  <div class="config-label">请求体</div>
                  <el-input v-model="selectedNode.bodyData" type="textarea" :rows="8"
                    placeholder='{"key":"value"}' class="code-editor" />
                  <div class="config-actions">
                    <el-button size="small" text @click="formatJson('bodyData')">格式化</el-button>
                    <el-button size="small" text @click="copyText(selectedNode.bodyData)">复制</el-button>
                  </div>
                </div>
              </template>

              <template v-else-if="selectedNode.bodyType === 'file'">
                <div class="config-section">
                  <div class="config-label">文件上传</div>
                  <div class="file-upload-area" v-if="!selectedNode._uploadedFile">
                    <el-upload
                      ref="fileUploadRef"
                      drag
                      :auto-upload="true"
                      :action="'/api/upload/file'"
                      :data="{ nodeCode: selectedNode.nodeCode }"
                      :on-success="handleFileUploadSuccess"
                      :on-error="handleFileUploadError"
                      :before-upload="beforeFileUpload"
                      accept=".xlsx,.xls,.csv,.json,.txt,.xml,.pdf,.doc,.docx,.zip,.rar"
                      :limit="1"
                    >
                      <el-icon class="upload-icon"><UploadFilled /></el-icon>
                      <div class="upload-text">拖拽文件到此处，或<em>点击上传</em></div>
                      <div class="upload-tip">支持 Excel、CSV、JSON、XML 等文件，最大 50MB</div>
                    </el-upload>
                  </div>
                  <div class="file-info" v-else>
                    <div class="file-card">
                      <el-icon class="file-icon"><Document /></el-icon>
                      <div class="file-detail">
                        <div class="file-name">{{ selectedNode._uploadedFile.fileName }}</div>
                        <div class="file-size">{{ formatFileSize(selectedNode._uploadedFile.size) }}</div>
                      </div>
                      <el-button type="danger" text @click="removeUploadedFile" :icon="Delete">移除</el-button>
                    </div>
                  </div>
                  <div class="config-hint-box">
                    <el-icon><InfoFilled /></el-icon>
                    <span>文件将作为 Multipart 请求体发送，文件ID会保存到节点配置中</span>
                  </div>
                </div>
                <div class="config-section">
                  <div class="config-label">请求头</div>
                  <el-input v-model="selectedNode.requestHeaders" type="textarea" :rows="3"
                    placeholder='文件上传时会自动设置 Content-Type' />
                </div>
              </template>

              <template v-else>
                <div class="config-section">
                  <div class="config-label">请求头</div>
                  <el-input v-model="selectedNode.requestHeaders" type="textarea" :rows="3"
                    placeholder='{"Content-Type":"application/x-www-form-urlencoded"}' />
                  <div class="config-actions">
                    <el-button size="small" text @click="formatJson('requestHeaders')">格式化</el-button>
                  </div>
                </div>
                <div class="config-section">
                  <div class="config-label">Form Data</div>
                  <el-input v-model="selectedNode.bodyData" type="textarea" :rows="6"
                    placeholder='{"key":"value"}' />
                </div>
              </template>
            </el-tab-pane>

            <el-tab-pane label="提取规则" name="extract">
              <div class="config-section">
                <div class="config-label">从响应中提取变量</div>
                <div class="config-hint-box" style="margin-bottom:14px">
                  <el-icon><InfoFilled /></el-icon>
                  <span>提取响应数据保存为变量，供后续节点使用（如：提取 token、用户ID 等）</span>
                </div>
                <div v-for="(rule, idx) in extractRuleList" :key="idx" class="rule-row">
                  <div class="rule-row-header">
                    <span class="rule-index">#{{ idx + 1 }}</span>
                    <el-button text type="danger" size="small" @click="removeExtractRule(idx)" :icon="Delete" />
                  </div>
                  <div class="rule-fields">
                    <div class="rule-field">
                      <div class="rule-field-label">变量名称</div>
                      <el-input v-model="rule.varName" size="small" placeholder="例如: token, userId" clearable />
                    </div>
                    <div class="rule-field">
                      <div class="rule-field-label">提取路径</div>
                      <el-input v-model="rule.jsonPath" size="small" placeholder="例如: $.data.token" clearable />
                    </div>
                  </div>
                  <div class="rule-field">
                    <div class="rule-field-label">路径说明</div>
                    <div class="path-examples">
                      <el-tag size="small" type="info" @click="rule.jsonPath = '$.data.id'">$.data.id</el-tag>
                      <el-tag size="small" type="info" @click="rule.jsonPath = '$.data.token'">$.data.token</el-tag>
                      <el-tag size="small" type="info" @click="rule.jsonPath = '$.data.items[0].name'">$.data.items[0].name</el-tag>
                      <el-tag size="small" type="info" @click="rule.jsonPath = '$.data.list.length'">$.data.list.length</el-tag>
                    </div>
                  </div>
                </div>
                <el-button type="primary" plain size="small" @click="addExtractRule" :icon="Plus" style="width:100%;margin-top:8px">
                  添加提取规则
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="断言规则" name="assert">
              <div class="config-section">
                <div class="config-label">验证响应结果</div>
                <div class="config-hint-box" style="margin-bottom:14px">
                  <el-icon><InfoFilled /></el-icon>
                  <span>设置验证条件，执行后自动检查是否符合预期</span>
                </div>

                <div class="assert-group">
                  <div class="assert-group-title">
                    <el-icon><Monitor /></el-icon>
                    <span>状态码检查</span>
                  </div>
                  <div class="rule-fields">
                    <div class="rule-field" style="flex:0 0 120px">
                      <el-select v-model="assertStatusMode" size="small" style="width:100%">
                        <el-option label="等于" value="eq" />
                        <el-option label="不等于" value="ne" />
                        <el-option label="在范围内" value="in" />
                      </el-select>
                    </div>
                    <div class="rule-field">
                      <el-input v-model="assertStatusCode" size="small" placeholder="例如: 200" clearable />
                    </div>
                  </div>
                  <div class="path-examples">
                    <el-tag size="small" type="info" @click="assertStatusCode='200'">200 成功</el-tag>
                    <el-tag size="small" type="info" @click="assertStatusCode='201'">201 创建</el-tag>
                    <el-tag size="small" type="info" @click="assertStatusCode='400'">400 参数错误</el-tag>
                    <el-tag size="small" type="info" @click="assertStatusCode='401'">401 未授权</el-tag>
                    <el-tag size="small" type="info" @click="assertStatusCode='404'">404 不存在</el-tag>
                    <el-tag size="small" type="info" @click="assertStatusCode='500'">500 服务器错误</el-tag>
                  </div>
                </div>

                <div class="assert-group">
                  <div class="assert-group-title">
                    <el-icon><DataLine /></el-icon>
                    <span>响应体字段检查</span>
                  </div>
                  <div v-for="(rule, idx) in assertBodyRules" :key="idx" class="rule-row">
                    <div class="rule-row-header">
                      <span class="rule-index">#{{ idx + 1 }}</span>
                      <el-button text type="danger" size="small" @click="removeAssertBodyRule(idx)" :icon="Delete" />
                    </div>
                    <div class="rule-fields">
                      <div class="rule-field">
                        <div class="rule-field-label">字段路径</div>
                        <el-input v-model="rule.path" size="small" placeholder="例如: $.data.code" clearable />
                      </div>
                      <div class="rule-field" style="flex:0 0 100px">
                        <div class="rule-field-label">比较方式</div>
                        <el-select v-model="rule.operator" size="small" style="width:100%">
                          <el-option label="等于" value="eq" />
                          <el-option label="不等于" value="ne" />
                          <el-option label="包含" value="contains" />
                          <el-option label="大于" value="gt" />
                          <el-option label="小于" value="lt" />
                          <el-option label="不为空" value="notNull" />
                        </el-select>
                      </div>
                      <div class="rule-field">
                        <div class="rule-field-label">期望值</div>
                        <el-input v-model="rule.expected" size="small" placeholder="期望值" clearable :disabled="rule.operator === 'notNull'" />
                      </div>
                    </div>
                    <div class="path-examples">
                      <el-tag size="small" type="info" @click="rule.path='$.code'">$.code 状态码</el-tag>
                      <el-tag size="small" type="info" @click="rule.path='$.message'">$.message 消息</el-tag>
                      <el-tag size="small" type="info" @click="rule.path='$.data.id'">$.data.id 数据ID</el-tag>
                      <el-tag size="small" type="info" @click="rule.path='$.data.list.length'">$.data.list.length 列表长度</el-tag>
                    </div>
                  </div>
                  <el-button type="primary" plain size="small" @click="addAssertBodyRule" :icon="Plus" style="width:100%;margin-top:8px">
                    添加字段检查
                  </el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>

          <div class="panel-footer">
            <el-button @click="moveNodeUp" :disabled="isFirstNode" :icon="Top" size="small">上移</el-button>
            <el-button @click="moveNodeDown" :disabled="isLastNode" :icon="Bottom" size="small">下移</el-button>
            <el-divider direction="vertical" />
            <el-button type="primary" @click="saveNode" :icon="Check" style="flex:1">保存节点</el-button>
            <el-button type="danger" @click="deleteNode" :icon="Delete" style="flex:1">删除节点</el-button>
          </div>
        </div>
      </transition>

      <div class="right-panel empty-right" v-if="!selectedNode">
        <div class="empty-config">
          <el-icon class="empty-config-icon"><Setting /></el-icon>
          <div class="empty-config-title">选择节点配置</div>
          <div class="empty-config-desc">点击左侧节点列表或画布中的节点</div>
        </div>
      </div>
    </div>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="importDialogVisible" title="批量导入接口" width="750px" :close-on-click-modal="false" class="import-dialog">
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
import {
  ArrowLeft, RefreshLeft, RefreshRight, Grid, MagicStick, CaretRight, Check,
  Connection, Box, Upload, List, Document, Setting, Close, Delete, Plus,
  UploadFilled, InfoFilled, Bottom, QuestionFilled, Rank, Top, Monitor, DataLine
} from '@element-plus/icons-vue'
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
const dragIndex = ref(null)
const dragOverIndex = ref(null)

const importDialogVisible = ref(false)
const importTab = ref('swagger')
const importLoading = ref(false)
const swaggerUrl = ref('')
const swaggerResult = ref([])
const jsonPreview = ref([])
const curlCommand = ref('')
const pasteJson = ref('')
const jsonUploadRef = ref(null)
const fileUploadRef = ref(null)

const extractRuleList = ref([])
const assertStatusMode = ref('eq')
const assertStatusCode = ref('')
const assertBodyRules = ref([])

const sortedNodes = computed(() => {
  return [...nodes.value].sort((a, b) => (a.sortNo || 0) - (b.sortNo || 0))
})

const selectedNodeIndex = computed(() => {
  if (!selectedNode.value) return -1
  return sortedNodes.value.findIndex(n => n.nodeCode === selectedNode.value.nodeCode)
})

const isFirstNode = computed(() => selectedNodeIndex.value <= 0)
const isLastNode = computed(() => selectedNodeIndex.value >= sortedNodes.value.length - 1)

const moveNodeUp = () => {
  const idx = selectedNodeIndex.value
  if (idx <= 0) return
  const sorted = sortedNodes.value
  const cur = sorted[idx]
  const prev = sorted[idx - 1]
  const tmpSort = cur.sortNo
  cur.sortNo = prev.sortNo
  prev.sortNo = tmpSort
  const ci = nodes.value.findIndex(n => n.nodeCode === cur.nodeCode)
  const pi = nodes.value.findIndex(n => n.nodeCode === prev.nodeCode)
  if (ci !== -1) nodes.value[ci] = { ...cur }
  if (pi !== -1) nodes.value[pi] = { ...prev }
  saveAll()
}

const moveNodeDown = () => {
  const idx = selectedNodeIndex.value
  if (idx < 0 || idx >= sortedNodes.value.length - 1) return
  const sorted = sortedNodes.value
  const cur = sorted[idx]
  const next = sorted[idx + 1]
  const tmpSort = cur.sortNo
  cur.sortNo = next.sortNo
  next.sortNo = tmpSort
  const ci = nodes.value.findIndex(n => n.nodeCode === cur.nodeCode)
  const ni = nodes.value.findIndex(n => n.nodeCode === next.nodeCode)
  if (ci !== -1) nodes.value[ci] = { ...cur }
  if (ni !== -1) nodes.value[ni] = { ...next }
  saveAll()
}

const onNodeDragStart = (e, index) => {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', index)
  e.target.style.opacity = '0.4'
}

const onNodeDragEnd = (e) => {
  e.target.style.opacity = '1'
  dragIndex.value = null
  dragOverIndex.value = null
}

const onNodeDragOver = (e, index) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

const onNodeDragLeave = () => {
  dragOverIndex.value = null
}

const onNodeDrop = (e, dropIndex) => {
  e.preventDefault()
  dragOverIndex.value = null
  const fromIndex = dragIndex.value
  if (fromIndex === null || fromIndex === dropIndex) return

  const sorted = sortedNodes.value
  const fromNode = sorted[fromIndex]
  const toNode = sorted[dropIndex]
  if (!fromNode || !toNode) return

  const fromSortNo = fromNode.sortNo || 0
  const toSortNo = toNode.sortNo || 0

  fromNode.sortNo = toSortNo
  toNode.sortNo = fromSortNo

  const fromIdx = nodes.value.findIndex(n => n.nodeCode === fromNode.nodeCode)
  const toIdx = nodes.value.findIndex(n => n.nodeCode === toNode.nodeCode)
  if (fromIdx !== -1) nodes.value[fromIdx] = { ...fromNode }
  if (toIdx !== -1) nodes.value[toIdx] = { ...toNode }

  saveAll()
  dragIndex.value = null
}

const onListDragStart = (e, nodeCode) => {
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', nodeCode)
}

const onListDrop = (e, targetCode) => {
  e.preventDefault()
  const sourceCode = e.dataTransfer.getData('text/plain')
  if (!sourceCode || sourceCode === targetCode) return

  const sorted = sortedNodes.value
  const sourceIdx = sorted.findIndex(n => n.nodeCode === sourceCode)
  const targetIdx = sorted.findIndex(n => n.nodeCode === targetCode)
  if (sourceIdx === -1 || targetIdx === -1) return

  const newSortNo = sorted[targetIdx].sortNo || 0
  const sourceNode = nodes.value.find(n => n.nodeCode === sourceCode)
  if (sourceNode) {
    sourceNode.sortNo = newSortNo
    const idx = nodes.value.findIndex(n => n.nodeCode === sourceCode)
    nodes.value[idx] = { ...sourceNode }
    saveAll()
  }
}

const loadNodes = async () => {
  const res = await api.get('/node/list', { params: { chainCode } })
  nodes.value = res.data || []
}

const selectNode = (node) => {
  const n = { ...node }
  if (n.bodyType === 'file' && n.bodyData && n.bodyData.startsWith('FILE_')) {
    n._uploadedFile = { fileId: n.bodyData, fileName: '已上传文件' }
  }
  selectedNode.value = n
  parseExtractRules()
  parseAssertRules()
}

const parseExtractRules = () => {
  try {
    const raw = selectedNode.value?.extractRules
    if (!raw) { extractRuleList.value = []; return }
    const obj = JSON.parse(raw)
    const rules = obj.rules || []
    extractRuleList.value = rules.map(r => ({ varName: r.varName || '', jsonPath: r.jsonPath || '' }))
  } catch { extractRuleList.value = [] }
}

const parseAssertRules = () => {
  try {
    const raw = selectedNode.value?.assertRules
    if (!raw) { assertStatusCode.value = ''; assertStatusMode.value = 'eq'; assertBodyRules.value = []; return }
    const obj = JSON.parse(raw)
    if (obj.statusCode !== undefined && obj.statusCode !== null && obj.statusCode !== '') {
      assertStatusCode.value = String(obj.statusCode)
      assertStatusMode.value = 'eq'
    } else {
      assertStatusCode.value = ''
      assertStatusMode.value = 'eq'
    }
    const bodyRules = obj.body || {}
    assertBodyRules.value = Object.entries(bodyRules).map(([path, expected]) => ({
      path, operator: 'eq', expected: String(expected)
    }))
  } catch { assertStatusCode.value = ''; assertBodyRules.value = [] }
}

const syncExtractRules = () => {
  if (!selectedNode.value) return
  const rules = extractRuleList.value.filter(r => r.varName && r.jsonPath)
  selectedNode.value.extractRules = rules.length > 0 ? JSON.stringify({ rules }) : ''
}

const syncAssertRules = () => {
  if (!selectedNode.value) return
  const obj = {}
  if (assertStatusCode.value !== '' && assertStatusCode.value !== null) {
    obj.statusCode = parseInt(assertStatusCode.value) || assertStatusCode.value
  }
  const bodyRules = {}
  assertBodyRules.value.forEach(r => {
    if (r.path) {
      if (r.operator === 'notNull') {
        bodyRules[r.path] = '__NOT_NULL__'
      } else {
        const val = r.expected
        bodyRules[r.path] = isNaN(val) ? val : Number(val)
      }
    }
  })
  if (Object.keys(bodyRules).length > 0) obj.body = bodyRules
  selectedNode.value.assertRules = Object.keys(obj).length > 0 ? JSON.stringify(obj) : ''
}

const addExtractRule = () => {
  extractRuleList.value.push({ varName: '', jsonPath: '' })
}

const removeExtractRule = (idx) => {
  extractRuleList.value.splice(idx, 1)
  syncExtractRules()
}

const addAssertBodyRule = () => {
  assertBodyRules.value.push({ path: '', operator: 'eq', expected: '' })
}

const removeAssertBodyRule = (idx) => {
  assertBodyRules.value.splice(idx, 1)
  syncAssertRules()
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

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(1) + ' ' + units[i]
}

const handleFileUploadSuccess = (response) => {
  if (response.code === 200) {
    selectedNode.value.bodyData = response.data.fileId
    selectedNode.value._uploadedFile = response.data
    ElMessage.success('文件上传成功')
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

const handleFileUploadError = () => {
  ElMessage.error('文件上传失败')
}

const beforeFileUpload = (file) => {
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过50MB')
    return false
  }
  return true
}

const removeUploadedFile = () => {
  selectedNode.value.bodyData = ''
  selectedNode.value._uploadedFile = null
}

const saveNode = async () => {
  syncExtractRules()
  syncAssertRules()
  const data = { ...selectedNode.value }
  delete data._uploadedFile
  await api.post('/node/edit', data)
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
    const data = { ...node }
    delete data._uploadedFile
    await api.post('/node/edit', data)
  }
  ElMessage.success('全部保存成功')
}

const onDragStart = (e) => {
  e.dataTransfer.setData('text/plain', 'httpNode')
}

const onDrop = async (e) => {
  const data = e.dataTransfer.getData('text/plain')
  if (data !== 'httpNode') return
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
    const message = res.data.message || '测试数据生成成功'
    let updatedCount = 0
    for (const node of nodes.value) {
      if (nodeData[node.nodeCode] && nodeData[node.nodeCode].bodyData) {
        node.bodyData = nodeData[node.nodeCode].bodyData
        updatedCount++
      }
    }
    if (updatedCount > 0) {
      await saveAll()
      ElMessage.success(`${message}，已写入 ${updatedCount} 个节点的请求体，请在右侧「请求配置」中查看`)
    } else {
      ElMessage.warning('未生成到有效数据，请检查节点是否配置了请求URL')
    }
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
.chain-edit { height: calc(100vh - 60px); display: flex; flex-direction: column; background: #f0f2f5; }

.toolbar {
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; }
.chain-title { font-size: 15px; font-weight: 600; color: #1f2937; }

.main-area { flex: 1; display: flex; overflow: hidden; }

.left-panel {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  padding: 16px;
  overflow-y: auto;
}
.panel-section { }
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-item {
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  background: #fafafa;
}
.node-item:hover { border-color: #409eff; background: #ecf5ff; }
.node-icon { font-size: 24px; color: #409eff; }
.node-item-info { display: flex; flex-direction: column; }
.node-item-name { font-size: 13px; font-weight: 500; color: #303133; }
.node-item-desc { font-size: 11px; color: #909399; margin-top: 2px; }

.node-list { max-height: 300px; overflow-y: auto; }
.node-list-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  transition: all 0.15s;
}
.node-list-item:hover { background: #f5f7fa; }
.node-list-item.active { background: #ecf5ff; }
.list-drag-handle { cursor: grab; color: #c0c4cc; font-size: 14px; flex-shrink: 0; }
.list-drag-handle:hover { color: #409eff; }
.method-tag { min-width: 42px; text-align: center; }
.node-list-name { font-size: 13px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-list { text-align: center; color: #c0c4cc; padding: 20px; font-size: 13px; }

.center-panel {
  flex: 1;
  background: #f5f7fa;
  overflow-y: auto;
  padding: 24px;
  position: relative;
  background-image: radial-gradient(circle, #ddd 1px, transparent 1px);
  background-size: 20px 20px;
}

.empty-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
.empty-icon { font-size: 48px; color: #c0c4cc; margin-bottom: 16px; }
.empty-title { font-size: 16px; color: #909399; margin-bottom: 8px; }
.empty-desc { font-size: 13px; color: #c0c4cc; }

.node-card {
  background: #fff;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 0;
  cursor: pointer;
  transition: all 0.2s;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}
.node-card:hover { border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,0.12); }
.node-card.drag-over { border-color: #409eff; border-style: dashed; background: #ecf5ff; }
.drag-handle { cursor: grab; color: #c0c4cc; font-size: 16px; margin-right: 4px; }
.drag-handle:hover { color: #409eff; }
.node-card:active .drag-handle { cursor: grabbing; }
.node-card.selected { border-color: #409eff; box-shadow: 0 0 0 3px rgba(64,158,255,0.15); }
.node-card.status-success { border-color: #67c23a; }
.node-card.status-failed { border-color: #f56c6c; }
.node-card.status-running { border-color: #409eff; animation: pulse 1.5s infinite; }

.node-card-header { display: flex; justify-content: space-between; align-items: center; }
.node-card-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.node-index {
  width: 28px; height: 28px; border-radius: 50%;
  background: #f0f2f5; display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: #606266; flex-shrink: 0;
}
.node-card.selected .node-index { background: #409eff; color: #fff; }
.node-card-info { min-width: 0; }
.node-card-name { font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 2px; }
.node-card-url { font-size: 12px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px; }
.node-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.status-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
}
.badge-success { background: #f0f9eb; color: #67c23a; }
.badge-failed { background: #fef0f0; color: #f56c6c; }
.badge-running { background: #ecf5ff; color: #409eff; }

.node-card-file {
  margin-top: 8px; padding: 6px 10px; background: #fafafa;
  border-radius: 6px; display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #909399;
}
.node-card-data {
  margin-top: 8px; padding: 6px 10px; background: #f0f9eb;
  border-radius: 6px; display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #67c23a; border: 1px solid #e1f3d8;
}

.connection-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}
.arrow-line { width: 2px; height: 16px; background: #c0c4cc; }
.arrow-icon { font-size: 16px; color: #c0c4cc; margin-top: -4px; }

.add-node-area { text-align: center; margin-top: 16px; }

.right-panel {
  width: 420px;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.empty-right { align-items: center; justify-content: center; }
.empty-config { text-align: center; color: #c0c4cc; }
.empty-config-icon { font-size: 48px; margin-bottom: 12px; }
.empty-config-title { font-size: 15px; color: #909399; margin-bottom: 6px; }
.empty-config-desc { font-size: 13px; }

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #1f2937; }
.config-icon { color: #409eff; }

.config-tabs { flex: 1; overflow-y: auto; padding: 0 16px; }
.config-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
.config-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; }

.config-section { margin-bottom: 18px; }
.config-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.help-icon { font-size: 14px; color: #c0c4cc; cursor: help; }
.config-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.config-row .config-label { margin-bottom: 0; min-width: 60px; }
.config-inline { display: flex; align-items: center; gap: 8px; }
.config-hint { font-size: 12px; color: #909399; }
.config-actions { display: flex; gap: 4px; margin-top: 4px; }

.code-editor :deep(textarea) { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; line-height: 1.5; }

.file-upload-area { border-radius: 8px; overflow: hidden; }
.file-upload-area :deep(.el-upload-dragger) { padding: 24px; }
.upload-icon { font-size: 36px; color: #c0c4cc; }
.upload-text { color: #606266; margin-top: 8px; }
.upload-text em { color: #409eff; font-style: normal; }
.upload-tip { color: #909399; font-size: 12px; margin-top: 6px; }

.file-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px; background: #f5f7fa; border-radius: 8px; border: 1px solid #e8e8e8;
}
.file-icon { font-size: 28px; color: #409eff; }
.file-detail { flex: 1; min-width: 0; }
.file-name { font-size: 13px; font-weight: 500; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 12px; color: #909399; margin-top: 2px; }

.config-hint-box {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 8px 12px; background: #f5f7fa; border-radius: 6px;
  font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.5;
}

.rule-row {
  background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px;
  padding: 12px; margin-bottom: 10px;
}
.rule-row-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
}
.rule-index {
  font-size: 12px; font-weight: 600; color: #409eff; background: #ecf5ff;
  padding: 2px 8px; border-radius: 10px;
}
.rule-fields { display: flex; gap: 10px; }
.rule-field { flex: 1; min-width: 0; }
.rule-field-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.path-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.path-examples .el-tag { cursor: pointer; }
.path-examples .el-tag:hover { opacity: 0.8; }

.assert-group {
  background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px;
  padding: 14px; margin-bottom: 14px;
}
.assert-group-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 500; color: #303133; margin-bottom: 10px;
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  gap: 10px;
}

@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(64,158,255,0.4); } 50% { box-shadow: 0 0 0 8px rgba(64,158,255,0); } }
.slide-right-enter-active, .slide-right-leave-active { transition: all 0.25s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(20px); opacity: 0; }
</style>
