<template>
  <div class="chain-edit">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button @click="$router.back()" icon="el-icon-back">返回</el-button>
        <el-divider direction="vertical" />
        <span class="chain-title">链路编排</span>
        <el-divider direction="vertical" />
        <el-select v-model="currentVersion" placeholder="选择版本" size="small" @change="onVersionChange" style="width: 160px" clearable>
          <el-option v-for="v in versions" :key="v.version" :label="'v' + v.version" :value="v.version" />
        </el-select>
        <div class="version-diff-summary" v-if="diffSummary">
          <span class="diff-badge diff-added">新增 {{ diffSummary.added }}</span>
          <span class="diff-badge diff-removed">删除 {{ diffSummary.removed }}</span>
          <span class="diff-badge diff-modified">修改 {{ diffSummary.modified }}</span>
          <span class="diff-badge diff-unchanged">未变 {{ diffSummary.unchanged }}</span>
        </div>
      </div>
      <div class="toolbar-right">
        <el-button-group>
          <el-button :type="viewMode === 'list' ? 'primary' : ''" @click="viewMode = 'list'" size="small">
            <i class="el-icon-menu"></i> 列表视图
          </el-button>
          <el-button :type="viewMode === 'trace' ? 'primary' : ''" @click="viewMode = 'trace'; loadTraceGroups()" size="small">
            <i class="el-icon-connection"></i> 分组视图
          </el-button>
        </el-button-group>
        <el-button @click="undo" :disabled="!canUndo" icon="el-icon-refresh-left">撤销</el-button>
        <el-button @click="redo" :disabled="!canRedo" icon="el-icon-refresh-right">重做</el-button>
        <el-button @click="autoLayout" icon="el-icon-menu">自动布局</el-button>
        <el-divider direction="vertical" />
        <el-button type="warning" @click="generateTestData" :loading="aiLoading" icon="el-icon-magic-stick">AI生成测试数据</el-button>
        <el-button type="success" @click="executeChain" :disabled="nodes.length === 0" icon="el-icon-caret-right">执行</el-button>
        <el-button type="primary" @click="saveAll" icon="el-icon-check">保存</el-button>
      </div>
    </div>

    <div class="main-area">
      <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
        <div class="panel-section">
          <div class="panel-title">
            <i class="el-icon-box"></i>
            <span>节点库</span>
          </div>
          <div class="node-item" draggable @dragstart="onDragStart">
            <i class="el-icon-connection node-icon http"></i>
            <div class="node-item-info">
              <span class="node-item-name">HTTP请求</span>
              <span class="node-item-desc">发送HTTP请求</span>
            </div>
          </div>
          <el-button type="primary" plain @click="openImportDialog" style="width:100%;margin-top:12px" icon="el-icon-upload">
            批量导入
          </el-button>
        </div>

        <div class="panel-section" style="margin-top:16px">
          <div class="panel-title">
            <i class="el-icon-menu"></i>
            <span>节点列表</span>
            <el-tag size="small" type="info" style="margin-left:auto">{{ nodes.length }}</el-tag>
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
              <i class="el-icon-rank list-drag-handle"></i>
              <el-tag size="small" :type="methodType(node.requestMethod)" class="method-tag">{{ node.requestMethod }}</el-tag>
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

      <!-- TraceId分组视图 -->
      <div class="center-panel trace-group-view" v-if="viewMode === 'trace'" ref="traceCanvasRef" @dragover.prevent>
        <div v-if="traceGroups.length === 0" class="empty-canvas">
          <i class="el-icon-connection empty-icon"></i>
          <div class="empty-title">暂无分组数据</div>
          <div class="empty-desc">链路节点未携带 bizOperTraceId 信息</div>
        </div>
        <div v-for="(group, gIdx) in traceGroups" :key="group.traceId" class="trace-group-card">
          <div class="trace-group-header">
            <div class="trace-group-info">
              <el-tag size="small" type="primary" effect="dark">TraceId</el-tag>
              <span class="trace-group-id">{{ group.traceId === '__ungrouped__' ? '未分组' : group.traceId }}</span>
            </div>
            <div class="trace-group-meta">
              <el-tag size="small" v-if="group.triggerEvent" type="info">{{ group.triggerEvent }}</el-tag>
              <span class="trace-group-url" v-if="group.pageUrl">{{ group.pageUrl }}</span>
              <el-tag size="small" type="success">{{ group.nodeCount }} 个节点</el-tag>
            </div>
          </div>
          <div class="trace-group-nodes">
            <div v-for="(node, nIdx) in group.nodes" :key="node.nodeCode" class="trace-node-card"
                 :class="{ selected: selectedNode && selectedNode.nodeCode === node.nodeCode, ignored: node.isIgnored }"
                 @click="selectNode(node)">
              <div class="trace-node-index">{{ nIdx + 1 }}</div>
              <div class="trace-node-info">
                <div class="trace-node-name">{{ node.nodeName || node.nodeCode }}</div>
                <div class="trace-node-url">{{ node.requestUrl }}</div>
              </div>
              <div class="trace-node-right">
                <el-tag size="small" :type="methodType(node.requestMethod)" effect="dark">{{ node.requestMethod }}</el-tag>
                <span v-if="node.isIgnored" class="trace-node-ignored">已忽略</span>
              </div>
            </div>
          </div>
          <div class="trace-group-footer">
            <el-button size="small" type="primary" plain @click="runTraceGroup(group.traceId)">执行此分组</el-button>
          </div>
        </div>
      </div>

      <div class="center-panel" v-if="viewMode === 'list'" ref="canvasRef" @dragover.prevent>
        <div v-if="nodes.length === 0" class="empty-canvas" @drop="onDrop" @dragover.prevent>
          <i class="el-icon-connection empty-icon"></i>
          <div class="empty-title">拖拽节点到此处</div>
          <div class="empty-desc">或点击左侧「批量导入」添加接口</div>
        </div>
        <template v-for="(node, index) in sortedNodes" :key="node.nodeCode">
          <div class="node-card"
              :class="{ selected: selectedNode && selectedNode.nodeCode === node.nodeCode, ['status-' + (nodeStatusMap[node.nodeCode] || '').toLowerCase()]: true, 'drag-over': dragOverIndex === index, ['change-' + (nodeChangeMap[node.nodeCode] || '')]: true }"
               draggable="true"
               @dragstart="onNodeDragStart($event, index)"
               @dragend="onNodeDragEnd"
               @dragover="onNodeDragOver($event, index)"
               @dragleave="onNodeDragLeave"
               @drop="onNodeDrop($event, index)"
               @click="selectNode(node)">
            <div class="node-card-header">
              <div class="node-card-left">
                <i class="el-icon-rank drag-handle"></i>
                <div class="node-index">{{ index + 1 }}</div>
                <div class="node-card-info">
                  <div class="node-card-name">{{ node.nodeName || node.nodeCode }}</div>
                  <div class="node-card-url">{{ node.requestUrl }}</div>
                </div>
              </div>
              <div class="node-card-right">
                <el-tag size="small" :type="methodType(node.requestMethod)" effect="dark">{{ node.requestMethod }}</el-tag>
                <div v-if="nodeChangeMap[node.nodeCode]" class="change-indicator" :class="nodeChangeMap[node.nodeCode]">
                  {{ nodeChangeMap[node.nodeCode] === 'added' ? '+' : nodeChangeMap[node.nodeCode] === 'removed' ? '-' : '~' }}
                </div>
                <div v-if="nodeStatusMap[node.nodeCode]" class="status-badge" :class="'badge-' + nodeStatusMap[node.nodeCode].toLowerCase()">
                  {{ nodeStatusMap[node.nodeCode] }}
                </div>
              </div>
            </div>
            <div v-if="node.bodyType === 'file'" class="node-card-file">
              <i class="el-icon-document"></i>
              <span>文件上传</span>
            </div>
            <div v-if="node.bodyData" class="node-card-data">
              <i class="el-icon-document"></i>
              <span>已填充测试数据</span>
            </div>
          </div>
          <div v-if="index < sortedNodes.length - 1" class="connection-arrow">
            <div class="arrow-line"></div>
            <i class="el-icon-bottom arrow-icon"></i>
          </div>
        </template>
        <div v-if="nodes.length > 0" class="add-node-area" @drop.stop="onDrop" @dragover.prevent>
          <el-button type="primary" plain @click="addNode" icon="el-icon-plus">新增节点</el-button>
        </div>
      </div>

      <!-- Center-Right Resizer -->
      <div class="panel-resizer right-resizer" @mousedown="startResizeRight" v-if="selectedNode"></div>

      <transition name="slide-right">
        <div class="right-panel" :style="{ width: rightPanelWidth + 'px' }" v-if="selectedNode">
          <div class="panel-header">
            <div class="panel-title-row">
              <i class="el-icon-setting config-icon"></i>
              <span>属性配置</span>
            </div>
            <el-button type="text" @click="selectedNode = null" icon="el-icon-close" />
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
                    <i class="el-icon-question help-icon"></i>
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
                    <el-button size="small" type="text" @click="formatJson('requestHeaders')">格式化</el-button>
                    <el-button size="small" type="text" @click="copyText(selectedNode.requestHeaders)">复制</el-button>
                  </div>
                </div>
                <div class="config-section">
                  <div class="config-label">请求体</div>
                  <el-input v-model="selectedNode.bodyData" type="textarea" :rows="8"
                    placeholder='{"key":"value"}' class="code-editor" />
                  <div class="config-actions">
                    <el-button size="small" type="text" @click="formatJson('bodyData')">格式化</el-button>
                    <el-button size="small" type="text" @click="copyText(selectedNode.bodyData)">复制</el-button>
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
                      <i class="el-icon-upload upload-icon"></i>
                      <div class="upload-text">拖拽文件到此处，或<em>点击上传</em></div>
                      <div class="upload-tip">支持 Excel、CSV、JSON、XML 等文件，最大 50MB</div>
                    </el-upload>
                  </div>
                  <div class="file-info" v-else>
                    <div class="file-card">
                      <i class="el-icon-document file-icon"></i>
                      <div class="file-detail">
                        <div class="file-name">{{ selectedNode._uploadedFile.fileName }}</div>
                        <div class="file-size">{{ formatFileSize(selectedNode._uploadedFile.size) }}</div>
                      </div>
                      <el-button type="danger" type="text" @click="removeUploadedFile" icon="el-icon-delete">移除</el-button>
                    </div>
                  </div>
                  <div class="config-hint-box">
                    <i class="el-icon-info"></i>
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
                    <el-button size="small" type="text" @click="formatJson('requestHeaders')">格式化</el-button>
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
                  <i class="el-icon-info"></i>
                  <span>提取响应数据保存为变量，供后续节点使用（如：提取 token、用户ID 等）</span>
                </div>
                <div v-for="(rule, idx) in extractRuleList" :key="idx" class="rule-row">
                  <div class="rule-row-header">
                    <span class="rule-index">#{{ idx + 1 }}</span>
                    <el-button type="text" type="danger" size="small" @click="removeExtractRule(idx)" icon="el-icon-delete" />
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
                <el-button type="primary" plain size="small" @click="addExtractRule" icon="el-icon-plus" style="width:100%;margin-top:8px">
                  添加提取规则
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="断言规则" name="assert">
              <div class="config-section">
                <div class="config-label">验证响应结果</div>
                <div class="config-hint-box" style="margin-bottom:14px">
                  <i class="el-icon-info"></i>
                  <span>设置验证条件，执行后自动检查是否符合预期</span>
                </div>

                <div class="assert-group">
                  <div class="assert-group-title">
                    <i class="el-icon-monitor"></i>
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
                    <i class="el-icon-data-line"></i>
                    <span>响应体字段检查</span>
                  </div>
                  <div v-for="(rule, idx) in assertBodyRules" :key="idx" class="rule-row">
                    <div class="rule-row-header">
                      <span class="rule-index">#{{ idx + 1 }}</span>
                      <el-button type="text" type="danger" size="small" @click="removeAssertBodyRule(idx)" icon="el-icon-delete" />
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
                  <el-button type="primary" plain size="small" @click="addAssertBodyRule" icon="el-icon-plus" style="width:100%;margin-top:8px">
                    添加字段检查
                  </el-button>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="差异对比" name="diff" v-if="diffData && diffData.nodes">
              <div class="config-section">
                <div class="config-label">
                  变更状态
                  <el-tag v-if="getNodeDiffType(selectedNode)" :type="diffTagType(getNodeDiffType(selectedNode))" size="small" style="margin-left:6px">
                    {{ diffLabel(getNodeDiffType(selectedNode)) }}
                  </el-tag>
                  <el-tag v-else type="info" size="small" style="margin-left:6px">无对比数据</el-tag>
                </div>
              </div>
              <FieldDiff v-if="getNodeFieldChanges(selectedNode).length > 0" :changes="getNodeFieldChanges(selectedNode)" />
              <div v-else class="config-section" style="color:#6b7280;font-size:13px;padding:12px 0">
                该节点与上一版本无字段差异
              </div>
              <AiAnalysis v-if="diffData.aiAnalysis" :analysis="diffData.aiAnalysis" />
            </el-tab-pane>
          </el-tabs>

          <div class="panel-footer">
            <el-button @click="moveNodeUp" :disabled="isFirstNode" icon="el-icon-top" size="small">上移</el-button>
            <el-button @click="moveNodeDown" :disabled="isLastNode" icon="el-icon-bottom" size="small">下移</el-button>
            <el-divider direction="vertical" />
            <el-button type="primary" @click="saveNode" icon="el-icon-check" style="flex:1">保存节点</el-button>
            <el-button type="danger" @click="deleteNode" icon="el-icon-delete" style="flex:1">删除节点</el-button>
          </div>
        </div>
      </transition>

      <div class="right-panel empty-right" v-if="!selectedNode">
        <div class="empty-config">
          <i class="el-icon-setting empty-config-icon"></i>
          <div class="empty-config-title">选择节点配置</div>
          <div class="empty-config-desc">点击左侧节点列表或画布中的节点</div>
        </div>
      </div>
    </div>

    <!-- 批量导入对话框 -->
    <el-dialog :visible.sync="importDialogVisible" title="批量导入接口" width="750px" :close-on-click-modal="false" class="import-dialog">
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
            <i class="el-icon-upload" style="font-size:40px;color:#909399"></i>
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

<script>
import { useRoute, useRouter } from '../router/compat'
import { Message } from 'element-ui'
import api from '../api'
import FieldDiff from '../components/FieldDiff.vue'
import AiAnalysis from '../components/AiAnalysis.vue'
import VersionHistory from '../components/VersionHistory.vue'

export default {
  name: 'ChainEdit',
  components: { FieldDiff, AiAnalysis, VersionHistory },
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
      resizeStartX: 0,
      resizeStartWidth: 0,
      nodeStatusMap: {},
      dragIndex: null,
      dragOverIndex: null,
      viewMode: 'list',
      traceGroups: [],
      importDialogVisible: false,
      importTab: 'swagger',
      importLoading: false,
      swaggerUrl: '',
      swaggerResult: [],
      jsonPreview: [],
      curlCommand: '',
      pasteJson: '',
      jsonUploadRef: null,
      fileUploadRef: null,
      extractRuleList: [],
      assertStatusMode: 'eq',
      assertStatusCode: '',
      assertBodyRules: [],
      // Version management
      versions: [],
      currentVersion: 0,
      diffSummary: null,
      diffData: null
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
    const route = useRoute()
    this.chainCode = route.params.chainCode
    this.loadNodes()
    this.loadVersions()
  },
  methods: {
    startResizeLeft(e) {
      this.isResizingLeft = true
      this.resizeStartX = e.clientX
      this.resizeStartWidth = this.leftPanelWidth
      document.addEventListener('mousemove', this._onResizeLeft)
      document.addEventListener('mouseup', this._stopResizeLeft)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    _onResizeLeft(e) {
      if (!this.isResizingLeft) return
      const diff = e.clientX - this.resizeStartX
      this.leftPanelWidth = Math.min(Math.max(this.resizeStartWidth + diff, 200), 400)
    },
    _stopResizeLeft() {
      this.isResizingLeft = false
      document.removeEventListener('mousemove', this._onResizeLeft)
      document.removeEventListener('mouseup', this._stopResizeLeft)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
    startResizeRight(e) {
      this.isResizingRight = true
      this.resizeStartX = e.clientX
      this.resizeStartWidth = this.rightPanelWidth
      document.addEventListener('mousemove', this._onResizeRight)
      document.addEventListener('mouseup', this._stopResizeRight)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    _onResizeRight(e) {
      if (!this.isResizingRight) return
      const diff = this.resizeStartX - e.clientX
      this.rightPanelWidth = Math.min(Math.max(this.resizeStartWidth + diff, 300), 600)
    },
    _stopResizeRight() {
      this.isResizingRight = false
      document.removeEventListener('mousemove', this._onResizeRight)
      document.removeEventListener('mouseup', this._stopResizeRight)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    },
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
    async loadNodes() {
      const res = await api.get('/node/list', { params: { chainCode: this.chainCode } })
      this.nodes = res.data || []
    },
    async loadTraceGroups() {
      if (!this.chainCode) return
      try {
        const res = await api.get('/chain/trace-groups', { params: { chainCode: this.chainCode } })
        this.traceGroups = res.data || []
      } catch (e) {
        console.error('加载Trace分组失败:', e)
      }
    },
    async runTraceGroup(traceId) {
      try {
        const res = await api.post('/chain/runByTrace', null, {
          params: { chainCode: this.chainCode, traceId, parallel: false }
        })
        const executionId = res.data.executionId
        Message.success('分组执行已启动')
        const router = useRouter()
        router.push('/execute/detail/' + executionId)
      } catch (e) {
        Message.error('执行失败: ' + (e.message || '未知错误'))
      }
    },
    selectNode(node) {
      const n = { ...node }
      if (n.bodyType === 'file' && n.bodyData && n.bodyData.startsWith('FILE_')) {
        n._uploadedFile = { fileId: n.bodyData, fileName: '已上传文件' }
      }
      this.selectedNode = n
      this.parseExtractRules()
      this.parseAssertRules()
    },
    parseExtractRules() {
      try {
        const raw = this.selectedNode && this.selectedNode.extractRules
        if (!raw) { this.extractRuleList = []; return }
        const obj = JSON.parse(raw)
        const rules = obj.rules || []
        this.extractRuleList = rules.map(r => ({ varName: r.varName || '', jsonPath: r.jsonPath || '' }))
      } catch (e) { this.extractRuleList = [] }
    },
    parseAssertRules() {
      try {
        const raw = this.selectedNode && this.selectedNode.assertRules
        if (!raw) { this.assertStatusCode = ''; this.assertStatusMode = 'eq'; this.assertBodyRules = []; return }
        const obj = JSON.parse(raw)
        if (obj.statusCode !== undefined && obj.statusCode !== null && obj.statusCode !== '') {
          this.assertStatusCode = String(obj.statusCode)
          this.assertStatusMode = 'eq'
        } else {
          this.assertStatusCode = ''
          this.assertStatusMode = 'eq'
        }
        const bodyRules = obj.body || {}
        this.assertBodyRules = Object.entries(bodyRules).map(([path, expected]) => ({
          path, operator: 'eq', expected: String(expected)
        }))
      } catch (e) { this.assertStatusCode = ''; this.assertBodyRules = [] }
    },
    syncExtractRules() {
      if (!this.selectedNode) return
      const rules = this.extractRuleList.filter(r => r.varName && r.jsonPath)
      this.selectedNode.extractRules = rules.length > 0 ? JSON.stringify({ rules }) : ''
    },
    syncAssertRules() {
      if (!this.selectedNode) return
      const obj = {}
      if (this.assertStatusCode !== '' && this.assertStatusCode !== null) {
        obj.statusCode = parseInt(this.assertStatusCode) || this.assertStatusCode
      }
      const bodyRules = {}
      this.assertBodyRules.forEach(r => {
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
      this.selectedNode.assertRules = Object.keys(obj).length > 0 ? JSON.stringify(obj) : ''
    },
    addExtractRule() {
      this.extractRuleList.push({ varName: '', jsonPath: '' })
    },
    removeExtractRule(idx) {
      this.extractRuleList.splice(idx, 1)
      this.syncExtractRules()
    },
    addAssertBodyRule() {
      this.assertBodyRules.push({ path: '', operator: 'eq', expected: '' })
    },
    removeAssertBodyRule(idx) {
      this.assertBodyRules.splice(idx, 1)
      this.syncAssertRules()
    },
    methodType(m) {
      const map = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger', PATCH: 'info' }
      return map[m] || 'info'
    },
    formatJson(field) {
      try {
        const val = this.selectedNode[field]
        this.selectedNode[field] = JSON.stringify(JSON.parse(val), null, 2)
      } catch (e) {
        Message.warning('JSON格式错误')
      }
    },
    copyText(text) {
      navigator.clipboard.writeText(text)
      Message.success('已复制')
    },
    formatFileSize(bytes) {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let i = 0
      let size = bytes
      while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
      return size.toFixed(1) + ' ' + units[i]
    },
    handleFileUploadSuccess(response) {
      if (response.code === 200) {
        this.selectedNode.bodyData = response.data.fileId
        this.selectedNode._uploadedFile = response.data
        Message.success('文件上传成功')
      } else {
        Message.error(response.message || '上传失败')
      }
    },
    handleFileUploadError() {
      Message.error('文件上传失败')
    },
    beforeFileUpload(file) {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        Message.error('文件大小不能超过50MB')
        return false
      }
      return true
    },
    removeUploadedFile() {
      this.selectedNode.bodyData = ''
      this.selectedNode._uploadedFile = null
    },
    async saveNode() {
      this.syncExtractRules()
      this.syncAssertRules()
      const data = { ...this.selectedNode }
      delete data._uploadedFile
      await api.post('/node/edit', data)
      Message.success('保存成功')
      this.loadNodes()
    },
    async deleteNode() {
      await api.post('/node/delete', null, { params: { id: this.selectedNode.id } })
      Message.success('删除成功')
      this.selectedNode = null
      this.loadNodes()
    },
    async saveAll() {
      for (const node of this.nodes) {
        const data = { ...node }
        delete data._uploadedFile
        await api.post('/node/edit', data)
      }
      Message.success('全部保存成功')
    },
    onDragStart(e) {
      e.dataTransfer.setData('text/plain', 'httpNode')
    },
    async onDrop(e) {
      const data = e.dataTransfer.getData('text/plain')
      if (data !== 'httpNode') return
      try {
        await api.post('/node/create', { chainCode: this.chainCode, nodeName: '新节点', requestMethod: 'GET', requestUrl: 'http://' })
        await this.loadNodes()
      } catch (err) {
        Message.error('新增失败: ' + (err.response && err.response.data && err.response.data.message || err.message))
      }
    },
    async addNode() {
      try {
        await api.post('/node/create', { chainCode: this.chainCode, nodeName: '新节点', requestMethod: 'GET', requestUrl: 'http://' })
        await this.loadNodes()
        Message.success('已新增节点')
      } catch (e) {
        Message.error('新增失败: ' + (e.response && e.response.data && e.response.data.message || e.message))
      }
    },
    openImportDialog() {
      this.swaggerUrl = ''
      this.swaggerResult = []
      this.jsonPreview = []
      this.curlCommand = ''
      this.pasteJson = ''
      this.importDialogVisible = true
    },
    async importFromSwagger() {
      if (!this.swaggerUrl) {
        Message.warning('请输入Swagger URL')
        return
      }
      this.importLoading = true
      try {
        const resp = await fetch(this.swaggerUrl)
        const spec = await resp.json()
        const result = []
        const paths = spec.paths || {}
        const baseUrl = (spec.servers && spec.servers[0] && spec.servers[0].url) || ''
        for (const [path, methods] of Object.entries(paths)) {
          for (const [method, detail] of Object.entries(methods)) {
            if (['get','post','put','delete','patch'].includes(method.toLowerCase())) {
              result.push({
                nodeName: detail.summary || detail.operationId || path,
                method: method.toUpperCase(),
                url: baseUrl + path,
                headers: JSON.stringify(detail.requestBody && detail.requestBody.content && detail.requestBody.content['application/json'] ? { 'Content-Type': 'application/json' } : {}),
                bodyData: ''
              })
            }
          }
        }
        this.swaggerResult = result
        Message.success('解析到 ' + result.length + ' 个接口')
      } catch (e) {
        Message.error('解析失败: ' + e.message)
      } finally {
        this.importLoading = false
      }
    },
    async confirmSwaggerImport() {
      const list = this.swaggerResult.map((item, i) => ({ ...item, sort: i + 1, parallelGroup: '' }))
      await api.post('/node/import', { chainCode: this.chainCode, interfaces: list })
      Message.success('导入 ' + list.length + ' 个接口成功')
      this.importDialogVisible = false
      this.loadNodes()
    },
    handleJsonFile(file) {
      var self = this
      const reader = new FileReader()
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result)
          const result = self.parseImportData(data)
          self.jsonPreview = result
          Message.success('解析到 ' + result.length + ' 个接口')
        } catch (err) {
          Message.error('JSON解析失败: ' + err.message)
        }
      }
      reader.readAsText(file.raw)
    },
    parseImportData(data) {
      if (Array.isArray(data)) {
        return data.map(item => ({
          nodeName: item.nodeName || item.name || item.title || '未命名',
          method: (item.method || 'GET').toUpperCase(),
          url: item.url || (item.request && item.request.url) || '',
          headers: typeof item.headers === 'string' ? item.headers : JSON.stringify(item.headers || {}),
          bodyData: item.bodyData || item.body || (item.request && item.request.body) || ''
        }))
      }
      if (data.item || data.requests) {
        const items = data.item || data.requests || []
        return items.map(item => ({
          nodeName: item.name || item.nodeName || '未命名',
          method: (item.request && item.request.method || item.method || 'GET').toUpperCase(),
          url: (item.request && item.request.url) || item.url || '',
          headers: JSON.stringify((item.request && item.request.header) || item.headers || {}),
          bodyData: (item.request && item.request.body && item.request.body.raw) || item.bodyData || ''
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
    },
    async confirmJsonImport() {
      const list = this.jsonPreview.map((item, i) => ({ ...item, sort: i + 1, parallelGroup: '' }))
      await api.post('/node/import', { chainCode: this.chainCode, interfaces: list })
      Message.success('导入 ' + list.length + ' 个接口成功')
      this.importDialogVisible = false
      this.loadNodes()
    },
    async importFromCurl() {
      if (!this.curlCommand.trim()) {
        Message.warning('请输入cURL命令')
        return
      }
      this.importLoading = true
      try {
        const result = this.parseCurl(this.curlCommand)
        await api.post('/node/import', { chainCode: this.chainCode, interfaces: [result] })
        Message.success('导入成功')
        this.importDialogVisible = false
        this.loadNodes()
      } catch (e) {
        Message.error('解析失败: ' + e.message)
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
        method,
        url,
        headers: JSON.stringify(headers),
        bodyData: body
      }
    },
    async importFromPaste() {
      if (!this.pasteJson.trim()) {
        Message.warning('请粘贴JSON数据')
        return
      }
      this.importLoading = true
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
        Message.success('导入 ' + list.length + ' 个接口成功')
        this.importDialogVisible = false
        this.loadNodes()
      } catch (e) {
        Message.error('JSON解析失败: ' + e.message)
      } finally {
        this.importLoading = false
      }
    },
    autoLayout() {
      Message.success('已自动布局')
    },
    undo() { Message.info('撤销') },
    redo() { Message.info('重做') },
    async generateTestData() {
      if (this.nodes.length === 0) {
        Message.warning('请先添加节点')
        return
      }
      this.aiLoading = true
      try {
        const res = await api.post('/ai/data/generate', { chainCode: this.chainCode, idGenerateMode: 'AUTO_INCREMENT', idStep: 1 })
        const nodeData = res.data.nodeData
        const msg = res.data.message || '测试数据生成成功'
        let updatedCount = 0
        for (const node of this.nodes) {
          if (nodeData[node.nodeCode] && nodeData[node.nodeCode].bodyData) {
            node.bodyData = nodeData[node.nodeCode].bodyData
            updatedCount++
          }
        }
        if (updatedCount > 0) {
          await this.saveAll()
          Message.success(msg + '，已写入 ' + updatedCount + ' 个节点的请求体，请在右侧「请求配置」中查看')
        } else {
          Message.warning('未生成到有效数据，请检查节点是否配置了请求URL')
        }
      } catch (e) {
        Message.error('AI生成失败: ' + (e.message || '未知错误'))
      } finally {
        this.aiLoading = false
      }
    },
    async executeChain() {
      const res = await api.post('/execute/run', { chainCode: this.chainCode })
      const executionId = res.data.executionId
      Message.success('执行已启动')
      const router = useRouter()
      router.push('/execute/detail/' + executionId)
    },
    // Version management
    async loadVersions() {
      try {
        const { data } = await api.get('/chain/versions', { params: { chainCode: this.chainCode, all: 'false' } })
        if (data.code === 200) {
          this.versions = data.data.list || []
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
        const { data } = await api.get('/chain/version/diff', {
          params: { chainCode: this.chainCode, version }
        })
        if (data.code === 200) {
          this.diffData = data.data
          this.diffSummary = data.data.summary || null
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
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* ── Layout ── */
.chain-edit {
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #fafafa 100%);
}

/* ── Toolbar ── */
.toolbar {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04);
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chain-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e1b4b;
  margin-left: 4px;
}

.toolbar ::v-deep .el-button {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.toolbar ::v-deep .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.toolbar ::v-deep .el-button--success {
  background: linear-gradient(135deg, #10b981, #34d399);
  border: none;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.toolbar ::v-deep .el-button--warning {
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
}

.toolbar ::v-deep .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* ── Main Area ── */
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Left Panel ── */
.left-panel {
  min-width: 200px;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex-shrink: 0;
}

/* ── Panel Resizer ── */
.panel-resizer {
  width: 6px;
  cursor: col-resize;
  background: rgba(99, 102, 241, 0.1);
  transition: background 0.2s, width 0.2s;
  flex-shrink: 0;
  position: relative;
}

.panel-resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background: rgba(99, 102, 241, 0.3);
  border-radius: 1px;
  transition: all 0.2s;
}

.panel-resizer:hover {
  background: rgba(99, 102, 241, 0.2);
  width: 8px;
}

.panel-resizer:hover::after {
  background: rgba(99, 102, 241, 0.6);
  height: 60px;
}

.panel-resizer:active {
  background: rgba(99, 102, 241, 0.3);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #4338ca;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
}

/* ── Node Item (Drag Source) ── */
.node-item {
  padding: 14px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 12px;
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(129, 140, 248, 0.02));
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.node-item:hover {
  border-color: rgba(99, 102, 241, 0.3);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(129, 140, 248, 0.04));
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
  transform: translateX(2px);
}

.node-item:active { cursor: grabbing; }

.node-icon { font-size: 24px; color: #6366f1; }

.node-item-info { display: flex; flex-direction: column; }
.node-item-name { font-size: 13px; font-weight: 500; color: #1e1b4b; }
.node-item-desc { font-size: 11px; color: #9ca3af; margin-top: 2px; }

/* ── Node List ── */
.node-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-list-item {
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.node-list-item:hover { background: rgba(99, 102, 241, 0.06); }
.node-list-item.active { background: rgba(99, 102, 241, 0.12); }

.list-drag-handle {
  cursor: grab;
  color: #c0c4cc;
  font-size: 14px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.list-drag-handle:hover { color: #6366f1; }

.method-tag { min-width: 42px; text-align: center; }

::v-deep .method-tag {
  border-radius: 6px;
  font-weight: 600;
  font-size: 11px;
}

.node-list-name {
  font-size: 13px;
  color: #1e1b4b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-list {
  text-align: center;
  color: #c0c4cc;
  padding: 24px;
  font-size: 13px;
}

/* ── Center Panel (Canvas) ── */
.center-panel {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
  position: relative;
  background-image:
    radial-gradient(circle, rgba(99, 102, 241, 0.15) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* ── Empty Canvas ── */
.empty-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.empty-icon { font-size: 56px; color: #c7d2fe; margin-bottom: 16px; }
.empty-title { font-size: 17px; color: #6366f1; margin-bottom: 8px; font-weight: 600; }
.empty-desc { font-size: 13px; color: #9ca3af; }

/* ── Node Cards ── */
.node-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2px solid rgba(99, 102, 241, 0.12);
  border-radius: 14px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
}

.node-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), transparent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s;
}

.node-card:hover {
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.12);
  transform: translateY(-2px);
}

.node-card:hover::after { opacity: 1; }

.node-card.drag-over {
  border-color: #6366f1;
  border-style: dashed;
  background: rgba(99, 102, 241, 0.06);
}

.drag-handle {
  cursor: grab;
  color: #c7d2fe;
  font-size: 16px;
  margin-right: 4px;
  transition: color 0.2s;
}

.drag-handle:hover { color: #6366f1; }
.node-card:active .drag-handle { cursor: grabbing; }

.node-card.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), 0 4px 16px rgba(99, 102, 241, 0.1);
}

.node-card.status-success { border-color: #10b981; }
.node-card.status-failed { border-color: #ef4444; }

.node-card.status-running {
  border-color: #6366f1;
  animation: pulseNode 2s infinite;
}

@keyframes pulseNode {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
}

/* ── Node Card Header ── */
.node-card-header { display: flex; justify-content: space-between; align-items: center; }
.node-card-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

.node-index {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.05));
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: #6366f1; flex-shrink: 0;
  transition: all 0.2s;
}

.node-card.selected .node-index {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.node-card-info { min-width: 0; }
.node-card-name { font-size: 14px; font-weight: 600; color: #1e1b4b; margin-bottom: 2px; }
.node-card-url {
  font-size: 12px; color: #9ca3af;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px;
}

.node-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* ── Status Badges ── */
.status-badge {
  font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 500;
}

.badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.badge-running { background: rgba(99, 102, 241, 0.1); color: #6366f1; }

/* ── Node Card Data ── */
.node-card-file {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(99, 102, 241, 0.04);
  border-radius: 8px;
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #9ca3af;
}

.node-card-data {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(16, 185, 129, 0.06);
  border-radius: 8px;
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.15);
}

/* ── Connection Arrow ── */
.connection-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
}

.arrow-line {
  width: 2px;
  height: 20px;
  background: linear-gradient(180deg, #c7d2fe, #a5b4fc);
  border-radius: 1px;
}

.arrow-icon {
  font-size: 18px;
  color: #a5b4fc;
  margin-top: -2px;
}

.add-node-area { text-align: center; margin-top: 18px; }

/* ── Right Panel (Config) ── */
.right-panel {
  min-width: 300px;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.empty-right { align-items: center; justify-content: center; }

.empty-config { text-align: center; color: #c7d2fe; }
.empty-config-icon { font-size: 56px; margin-bottom: 14px; }
.empty-config-title { font-size: 15px; color: #6366f1; margin-bottom: 6px; font-weight: 600; }
.empty-config-desc { font-size: 13px; color: #9ca3af; }

/* ── Panel Header ── */
.panel-header {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(99, 102, 241, 0.02);
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1e1b4b;
}

.config-icon { color: #6366f1; }

/* ── Config Tabs ── */
.config-tabs {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.config-tabs ::v-deep .el-tabs__header { margin-bottom: 18px; }
.config-tabs ::v-deep .el-tabs__active-bar { background: #6366f1; }
.config-tabs ::v-deep .el-tabs__nav-wrap::after { height: 1px; }

/* ── Config Sections ── */
.config-section { margin-bottom: 20px; }

.config-label {
  font-size: 13px;
  font-weight: 500;
  color: #4338ca;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.help-icon { font-size: 14px; color: #c7d2fe; cursor: help; transition: color 0.2s; }
.help-icon:hover { color: #6366f1; }

.config-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.config-row .config-label { margin-bottom: 0; min-width: 70px; }
.config-inline { display: flex; align-items: center; gap: 8px; }

.config-hint { font-size: 12px; color: #9ca3af; }
.config-actions { display: flex; gap: 4px; margin-top: 4px; }

/* ── Code Editor ── */
.code-editor ::v-deep textarea {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.5;
  border-radius: 10px;
}

/* ── File Upload ── */
.file-upload-area { border-radius: 12px; overflow: hidden; }
.file-upload-area ::v-deep .el-upload-dragger {
  padding: 32px;
  border: 2px dashed rgba(99, 102, 241, 0.2);
  border-radius: 12px;
  transition: all 0.2s;
}

.file-upload-area ::v-deep .el-upload-dragger:hover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.03);
}

.upload-icon { font-size: 40px; color: #c7d2fe; }
.upload-text { color: #6b7280; margin-top: 10px; font-size: 13px; }
.upload-text em { color: #6366f1; font-style: normal; }
.upload-tip { color: #9ca3af; font-size: 12px; margin-top: 8px; }

/* ── File Card ── */
.file-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(129, 140, 248, 0.02));
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 12px;
  transition: all 0.2s;
}

.file-card:hover {
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.2);
}

.file-icon { font-size: 32px; color: #6366f1; }
.file-detail { flex: 1; min-width: 0; }
.file-name { font-size: 13px; font-weight: 500; color: #1e1b4b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 12px; color: #9ca3af; margin-top: 2px; }

/* ── Config Hint Box ── */
.config-hint-box {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(129, 140, 248, 0.02));
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 10px;
  font-size: 12px; color: #6b7280; margin-top: 8px; line-height: 1.5;
}

/* ── Rule Row ── */
.rule-row {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(129, 140, 248, 0.01));
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.rule-row:hover {
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.18);
}

.rule-row-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}

.rule-index {
  font-size: 12px; font-weight: 600; color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 3px 10px; border-radius: 10px;
}

.rule-fields { display: flex; gap: 10px; }
.rule-field { flex: 1; min-width: 0; }
.rule-field-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }

.path-examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.path-examples .el-tag {
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}
.path-examples .el-tag:hover { opacity: 0.8; transform: translateY(-1px); }

/* ── Assert Group ── */
.assert-group {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(129, 140, 248, 0.01));
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}

.assert-group-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: #1e1b4b; margin-bottom: 12px;
}

/* ── Panel Footer ── */
.panel-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  gap: 10px;
  background: rgba(99, 102, 241, 0.02);
}

/* ── Scrollbars ── */
.left-panel::-webkit-scrollbar,
.config-tabs::-webkit-scrollbar { width: 5px; }
.left-panel::-webkit-scrollbar-track,
.config-tabs::-webkit-scrollbar-track { background: transparent; }
.left-panel::-webkit-scrollbar-thumb,
.config-tabs::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 3px;
}
.left-panel::-webkit-scrollbar-thumb:hover,
.config-tabs::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.4);
}

.center-panel::-webkit-scrollbar { width: 6px; }
.center-panel::-webkit-scrollbar-track { background: transparent; }
.center-panel::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.25);
  border-radius: 3px;
}

/* ── Dialog Overrides ── */
::v-deep .el-dialog {
  border-radius: 16px;
  overflow: hidden;
}

::v-deep .el-dialog__header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), transparent);
}

::v-deep .el-dialog__body {
  padding: 24px;
}

/* ── Element UI Overrides ── */
::v-deep .el-input__inner,
::v-deep .el-textarea__inner {
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d0d5dd;
  box-shadow: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

::v-deep .el-input__inner:hover,
::v-deep .el-textarea__inner:hover {
  border-color: #a5b4fc;
  box-shadow: none;
}

::v-deep .el-input__inner:focus,
::v-deep .el-textarea__inner:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}

::v-deep .el-tabs__active-bar { background: #6366f1; }
::v-deep .el-tabs__item {
  font-weight: 500;
  color: #6b7280;
  transition: color 0.2s;
}
::v-deep .el-tabs__item.is-active {
  color: #6366f1;
  font-weight: 600;
}

/* ── Version Diff Summary ── */
.version-diff-summary {
  display: flex;
  gap: 8px;
  margin-left: 8px;
}
.diff-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}
.diff-added { color: #16a34a; background: #f0fdf4; }
.diff-removed { color: #dc2626; background: #fef2f2; }
.diff-modified { color: #d97706; background: #fffbeb; }
.diff-unchanged { color: #6b7280; background: #f9fafb; }

/* ── Node Change Highlighting ── */
.node-card.change-added {
  border: 2px solid #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}
.node-card.change-modified {
  border: 2px solid #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}
.node-card.change-removed {
  border: 2px solid #ef4444;
  opacity: 0.6;
}
.change-indicator {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}
.change-indicator.added { background: #22c55e; }
.change-indicator.modified { background: #f59e0b; }
.change-indicator.removed { background: #ef4444; }

/* ── Node List Change Items ── */
.node-list-item.change-added {
  border-left: 3px solid #22c55e;
}
.node-list-item.change-modified {
  border-left: 3px solid #f59e0b;
}
.node-list-item.change-removed {
  border-left: 3px solid #ef4444;
  opacity: 0.6;
}

/* ── Trace Group View ── */
.trace-group-view {
  padding: 24px;
  display: block;
}

.trace-group-card {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 14px;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.trace-group-header {
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(129, 140, 248, 0.03));
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
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
  gap: 8px;
}

.trace-group-url {
  font-size: 12px;
  color: #9ca3af;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-group-nodes {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trace-node-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.trace-node-card:hover {
  border-color: rgba(99, 102, 241, 0.25);
  background: rgba(99, 102, 241, 0.02);
}

.trace-node-card.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.trace-node-card.ignored {
  opacity: 0.5;
  background: #f9fafb;
}

.trace-node-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
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
  margin-top: 2px;
}

.trace-node-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.trace-node-ignored {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
}

.trace-group-footer {
  padding: 10px 18px;
  border-top: 1px solid rgba(99, 102, 241, 0.08);
  display: flex;
  justify-content: flex-end;
}
</style>
