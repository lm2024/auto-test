<template>
  <div class="node-config" v-if="local.id">
    <div class="panel-header">
      <div class="panel-title-row">
        <SettingIcon class="config-icon" />
        <span>属性配置</span>
      </div>
      <t-button theme="default" variant="text" shape="square" @click="emit('close')">
        <template #icon><CloseIcon /></template>
      </t-button>
    </div>

    <t-tabs v-model="activeTab" class="config-tabs">
      <!-- 基础信息 -->
      <t-tab-panel label="基础信息" value="basic">
        <div class="cfg">
          <div class="cfg-label">节点名称</div>
          <t-input v-model="local.nodeName" placeholder="请输入节点名称" clearable />

          <div class="cfg-label">接口归属</div>
          <div class="scope-row">
            <t-select v-model="local.interfaceScope" style="flex:1">
              <t-option label="内网 INTERNAL" value="INTERNAL" />
              <t-option label="外网 EXTERNAL" value="EXTERNAL" />
              <t-option label="未知 UNKNOWN" value="UNKNOWN" />
            </t-select>
            <t-button theme="default" variant="outline" size="small" :loading="classifying" @click="autoClassify">
              <template #icon><LinkIcon /></template>自动识别
            </t-button>
          </div>
          <div class="cfg-hint">根据 URL 在「系统注册表」中匹配内外网归属</div>

          <div class="cfg-label">目标系统</div>
          <t-input v-model="local.targetSystem" placeholder="如 order-service / 支付中心" clearable />

          <div class="cfg-label">等待时间</div>
          <div class="cfg-inline">
            <t-input-number v-model="local.delaySeconds" :min="0" :max="3600" size="small" />
            <span class="cfg-hint">秒，执行后等待再执行下一节点</span>
          </div>
        </div>
      </t-tab-panel>

      <!-- 请求配置 -->
      <t-tab-panel label="请求配置" value="request">
        <div class="cfg">
          <div class="cfg-label">请求方法</div>
          <t-select v-model="local.requestMethod" style="width:100%">
            <t-option v-for="m in METHODS" :key="m" :label="m" :value="m" />
          </t-select>

          <div class="cfg-label">URL</div>
          <t-input v-model="local.requestUrl" placeholder="https://api.example.com/endpoint" clearable />

          <div class="cfg-label">请求体类型</div>
          <t-radio-group v-model="local.bodyType" size="small">
            <t-radio-button value="json">JSON</t-radio-button>
            <t-radio-button value="file">文件上传</t-radio-button>
            <t-radio-button value="form">Form Data</t-radio-button>
          </t-radio-group>

          <template v-if="local.bodyType === 'json'">
            <div class="cfg-label">请求头</div>
            <MonacoEditor v-model="local.requestHeaders" language="json" :height="120" />
            <div class="cfg-actions">
              <t-button size="small" theme="default" variant="text" @click="formatJson('requestHeaders')">格式化</t-button>
            </div>
            <div class="cfg-label">请求体</div>
            <MonacoEditor v-model="local.bodyData" language="json" :height="200" />
            <div class="cfg-actions">
              <t-button size="small" theme="default" variant="text" @click="formatJson('bodyData')">格式化</t-button>
            </div>
          </template>

          <template v-else-if="local.bodyType === 'file'">
            <div class="cfg-label">文件上传</div>
            <t-upload
              v-model="fileList"
              theme="custom"
              draggable
              :auto-upload="true"
              action="/api/upload/file"
              :data="{ nodeCode: local.nodeCode }"
              :before-upload="beforeUpload"
              accept=".xlsx,.xls,.csv,.json,.txt,.xml,.pdf,.doc,.docx,.zip,.rar"
              :max="1"
              @success="onUploadSuccess"
              @fail="onUploadError"
            >
              <template #dragContent>
                <CloudUploadIcon class="upload-icon" />
                <div class="upload-text">拖拽文件到此处，或<em>点击上传</em></div>
                <div class="upload-tip">最大 50MB，作为 Multipart 请求体发送</div>
              </template>
            </t-upload>
            <div class="cfg-hint-box">
              <InfoCircleIcon /><span>文件ID会保存到节点配置中</span>
            </div>
          </template>

          <template v-else>
            <div class="cfg-label">请求头</div>
            <MonacoEditor v-model="local.requestHeaders" language="json" :height="120" />
            <div class="cfg-label">Form Data</div>
            <MonacoEditor v-model="local.bodyData" language="json" :height="180" />
          </template>
        </div>
      </t-tab-panel>

      <!-- 提取规则 -->
      <t-tab-panel label="提取规则" value="extract">
        <div class="cfg">
          <NodeRulesEditor
            mode="extract"
            :extract-rules="local.extractRules"
            @update:extractRules="onExtract"
          />
        </div>
      </t-tab-panel>

      <!-- 断言规则 -->
      <t-tab-panel label="断言规则" value="assert">
        <div class="cfg">
          <NodeRulesEditor
            mode="assert"
            :assert-rules="local.assertRules"
            @update:assertRules="onAssert"
          />
        </div>
      </t-tab-panel>
    </t-tabs>

    <div class="panel-footer">
      <t-button theme="primary" block :loading="saving" @click="save">
        <template #icon><SaveIcon /></template>保存节点
      </t-button>
      <t-button theme="default" variant="outline" block style="margin-top:8px" @click="emit('debug')">
        <template #icon><BugIcon /></template>调试
      </t-button>
      <t-button theme="danger" variant="outline" block style="margin-top:8px" @click="remove">
        <template #icon><DeleteIcon /></template>删除节点
      </t-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  SettingIcon, CloseIcon, SaveIcon, DeleteIcon, LinkIcon, BugIcon,
  CloudUploadIcon, InfoCircleIcon
} from 'tdesign-icons-vue-next'
import MonacoEditor from '../MonacoEditor.vue'
import NodeRulesEditor from './NodeRulesEditor.vue'
import nodeApi from '../../api/node'
import registryApi from '../../api/registry'

const props = defineProps({
  node: { type: Object, default: null },
  chainCode: { type: String, default: '' }
})
const emit = defineEmits(['save', 'delete', 'debug', 'close', 'update:node'])

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const activeTab = ref('basic')
const saving = ref(false)
const classifying = ref(false)
const fileList = ref([])

const local = reactive({
  id: null, nodeCode: '', nodeName: '', requestMethod: 'GET', requestUrl: '',
  requestHeaders: '{}', bodyType: 'json', bodyData: '',
  extractRules: '', assertRules: '', interfaceScope: 'UNKNOWN', targetSystem: '',
  delaySeconds: 0
})

function normalize(n) {
  return {
    id: n.id, nodeCode: n.nodeCode, nodeName: n.nodeName || '',
    requestMethod: n.requestMethod || 'GET', requestUrl: n.requestUrl || '',
    requestHeaders: n.requestHeaders || '{}', bodyType: n.bodyType || 'json',
    bodyData: n.bodyData || '', extractRules: n.extractRules || '',
    assertRules: n.assertRules || '', interfaceScope: n.interfaceScope || 'UNKNOWN',
    targetSystem: n.targetSystem || '', delaySeconds: n.delaySeconds || 0
  }
}

watch(
  () => props.node,
  (n) => {
    if (n) Object.assign(local, normalize(n))
  },
  { immediate: true, deep: false }
)

watch(local, () => emit('update:node', { ...local }), { deep: true })

function onExtract(v) { local.extractRules = v }
function onAssert(v) { local.assertRules = v }

function formatJson(field) {
  try {
    local[field] = JSON.stringify(JSON.parse(local[field]), null, 2)
  } catch {
    MessagePlugin.warning('JSON格式错误')
  }
}

async function autoClassify() {
  if (!local.requestUrl) {
    MessagePlugin.warning('请先填写 URL')
    return
  }
  classifying.value = true
  try {
    const res = await registryApi.classify(local.requestUrl)
    if (res.code === 200 && res.data) {
      local.interfaceScope = res.data.scope || 'UNKNOWN'
      if (res.data.systemName) local.targetSystem = res.data.systemName
      MessagePlugin.success('已识别为 ' + (res.data.scope || 'UNKNOWN'))
    } else {
      MessagePlugin.warning(res.message || '识别失败')
    }
  } catch (e) {
    MessagePlugin.error('识别失败: ' + (e.response?.data?.message || e.message))
  } finally {
    classifying.value = false
  }
}

function beforeUpload(file) {
  if (file.size > 50 * 1024 * 1024) {
    MessagePlugin.error('文件大小不能超过50MB')
    return false
  }
  return true
}
function onUploadSuccess(ctx) {
  const r = ctx?.response || {}
  if (r.code === 200) {
    local.bodyData = r.data.fileId
    MessagePlugin.success('文件上传成功')
  } else {
    MessagePlugin.error(r.message || '上传失败')
  }
}
function onUploadError() {
  MessagePlugin.error('文件上传失败')
}

async function save() {
  saving.value = true
  try {
    const data = { ...local }
    const res = await nodeApi.edit(data)
    if (res.code === 200) {
      MessagePlugin.success('保存成功')
      emit('save', { ...local })
    } else {
      MessagePlugin.error(res.message || '保存失败')
    }
  } catch (e) {
    MessagePlugin.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally {
    saving.value = false
  }
}

function remove() {
  emit('delete', local.id)
}
</script>

<style scoped>
.node-config { display: flex; flex-direction: column; height: 100%; }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid #e5e6eb;
}
.panel-title-row { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1d2129; }
.config-icon { color: #0052d9; }
.config-tabs { flex: 1 1 auto; overflow: auto; }
.cfg { display: flex; flex-direction: column; gap: 8px; padding: 8px 4px; }
.cfg-label { font-size: 13px; color: #4e5969; margin-top: 6px; }
.cfg-inline { display: flex; align-items: center; gap: 8px; }
.cfg-hint { font-size: 12px; color: #a9aeb8; }
.cfg-actions { display: flex; gap: 8px; }
.scope-row { display: flex; gap: 8px; align-items: center; }
.cfg-hint-box {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4e5969;
  background: #f2f5fa; border-radius: 6px; padding: 8px 10px;
}
.upload-icon { font-size: 28px; color: #0052d9; }
.upload-text { font-size: 13px; color: #1d2129; }
.upload-tip { font-size: 12px; color: #a9aeb8; }
.panel-footer { padding: 12px 16px; border-top: 1px solid #e5e6eb; }
</style>
