<template>
  <t-drawer
    :visible="visible"
    :header="'节点调试 · ' + (node?.nodeName || '')"
    size="760px"
    @close="emit('close')"
  >
    <div class="debug-wrap">
      <div class="debug-req">
        <div class="dbg-title">请求</div>
        <div class="dbg-line">
          <t-select v-model="form.requestMethod" style="width:110px">
            <t-option v-for="m in METHODS" :key="m" :label="m" :value="m" />
          </t-select>
          <t-input v-model="form.requestUrl" placeholder="请求 URL" clearable />
        </div>
        <div class="dbg-field-label">请求头 (JSON)</div>
        <MonacoEditor v-model="form.requestHeaders" language="json" :height="110" />
        <div class="dbg-field-label">请求体类型</div>
        <t-radio-group v-model="form.bodyType" size="small">
          <t-radio-button value="json">JSON</t-radio-button>
          <t-radio-button value="file">文件上传</t-radio-button>
          <t-radio-button value="form">Form</t-radio-button>
          <t-radio-button value="none">无</t-radio-button>
        </t-radio-group>

        <!-- 文件上传：与「属性配置」页请求完全一致（上传后 bodyData 存 fileId） -->
        <template v-if="form.bodyType === 'file'">
          <div class="dbg-field-label">文件上传</div>
          <t-upload
            v-model="fileList"
            theme="custom"
            draggable
            :auto-upload="true"
            action="/api/upload/file"
            :data="{ nodeCode }"
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
          <div class="dbg-hint-box" v-if="form.bodyData">
            <InfoCircleIcon /><span>已绑定文件 fileId：{{ form.bodyData }}</span>
          </div>
        </template>

        <!-- 文本体（JSON / Form） -->
        <template v-else-if="form.bodyType !== 'none'">
          <div class="dbg-field-label">请求体</div>
          <MonacoEditor
            v-model="form.bodyData"
            language="json"
            :height="200"
          />
        </template>
        <div class="dbg-field-label">
          变量注入
          <t-tooltip content="调试时把全局变量替换进占位符 ${varName}" placement="top">
            <HelpCircleIcon class="help-icon" />
          </t-tooltip>
        </div>
        <div class="var-chips">
          <t-tag
            v-for="v in variableList"
            :key="v.id"
            size="small"
            theme="default"
            class="var-chip"
            @click="insertVar(v.varName)"
          >{{ v.varName }}</t-tag>
          <span v-if="variableList.length === 0" class="var-empty">暂无全局变量</span>
        </div>
        <t-button theme="primary" :loading="loading" block style="margin-top:12px" @click="run">
          <template #icon><PlayCircleIcon /></template>发送请求
        </t-button>
      </div>

      <div class="debug-res">
        <div class="dbg-title">响应</div>
        <div v-if="result" class="res-box">
          <div class="res-meta">
            <t-tag :theme="result.statusCode >= 200 && result.statusCode < 400 ? 'success' : 'danger'">
              状态码 {{ result.statusCode }}
            </t-tag>
            <t-tag theme="default" variant="light">耗时 {{ result.durationMs }} ms</t-tag>
          </div>
          <div v-if="result.error" class="res-error">{{ result.error }}</div>
          <div class="dbg-field-label">响应头</div>
          <pre class="res-pre">{{ prettyHeaders }}</pre>
          <div class="dbg-field-label">响应体</div>
          <pre class="res-pre">{{ prettyBody }}</pre>
        </div>
        <t-empty v-else description="点击「发送请求」查看响应" />
      </div>
    </div>
  </t-drawer>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { PlayCircleIcon, HelpCircleIcon, CloudUploadIcon, InfoCircleIcon } from 'tdesign-icons-vue-next'
import MonacoEditor from '../MonacoEditor.vue'
import nodeApi from '../../api/node'
import variableApi from '../../api/variable'

const props = defineProps({
  visible: { type: Boolean, default: false },
  node: { type: Object, default: null },
  chainCode: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const form = ref({ requestMethod: 'GET', requestUrl: '', requestHeaders: '{}', bodyType: 'json', bodyData: '' })
const result = ref(null)
const loading = ref(false)
const variableList = ref([])
const fileList = ref([])
const nodeCode = computed(() => (props.node && props.node.nodeCode) || '')

const prettyHeaders = computed(() => {
  if (!result.value?.headers) return ''
  try {
    return JSON.stringify(JSON.parse(result.value.headers), null, 2)
  } catch {
    return result.value.headers
  }
})
const prettyBody = computed(() => {
  if (!result.value?.body) return ''
  try {
    return JSON.stringify(JSON.parse(result.value.body), null, 2)
  } catch {
    return result.value.body
  }
})

watch(
  () => props.visible,
  async (v) => {
      if (v && props.node) {
        form.value = {
          requestMethod: props.node.requestMethod || 'GET',
          requestUrl: props.node.requestUrl || '',
          requestHeaders: props.node.requestHeaders || '{}',
          bodyType: props.node.bodyType || 'json',
          bodyData: props.node.bodyData || ''
        }
        // 已配置为文件上传的节点：回显已上传文件
        fileList.value = (form.value.bodyType === 'file' && form.value.bodyData && String(form.value.bodyData).startsWith('FILE_'))
          ? [{ name: form.value.bodyData, status: 'success' }]
          : []
        result.value = null
        await loadVariables()
      }
  }
)

async function loadVariables() {
  try {
    const res = await variableApi.list({ chainCode: props.chainCode, scope: '' })
    if (res.code === 200) variableList.value = res.data || []
  } catch (e) {
    /* 变量加载失败不影响调试 */
  }
}

function insertVar(name) {
  form.value.requestUrl += '${' + name + '}'
  MessagePlugin.info('已插入 ${' + name + '}')
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
    form.value.bodyData = r.data.fileId
    MessagePlugin.success('文件上传成功')
  } else {
    MessagePlugin.error(r.message || '上传失败')
  }
}
function onUploadError() {
  MessagePlugin.error('文件上传失败')
}

async function run() {
  loading.value = true
  try {
    const variables = {}
    variableList.value.forEach((v) => {
      variables[v.varName] = v.varValue
    })
    const res = await nodeApi.debug({
      chainCode: props.chainCode,
      requestUrl: form.value.requestUrl,
      requestMethod: form.value.requestMethod,
      requestHeaders: form.value.requestHeaders,
      bodyType: form.value.bodyType === 'none' ? null : form.value.bodyType,
      bodyData: form.value.bodyType === 'none' ? null : form.value.bodyData,
      variables
    })
    if (res.code === 200) {
      result.value = res.data
    } else {
      MessagePlugin.error(res.message || '调试失败')
    }
  } catch (e) {
    MessagePlugin.error('调试失败: ' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.debug-wrap { display: flex; gap: 16px; height: 100%; }
.debug-req { flex: 1 1 50%; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.debug-res { flex: 1 1 50%; min-width: 0; overflow: auto; }
.dbg-title { font-size: 14px; font-weight: 600; color: #1d2129; margin-bottom: 4px; }
.dbg-line { display: flex; gap: 8px; }
.dbg-field-label { font-size: 12px; color: #4e5969; margin-top: 6px; }
.help-icon { margin-left: 4px; color: #86909c; }
.var-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.var-chip { cursor: pointer; }
.var-empty { font-size: 12px; color: #a9aeb8; }
.res-box { display: flex; flex-direction: column; gap: 6px; }
.res-meta { display: flex; gap: 8px; }
.res-error { color: #d54941; font-size: 13px; }
.res-pre {
  background: #f7f8fa; border: 1px solid #e5e6eb; border-radius: 6px;
  padding: 10px; font-size: 12px; white-space: pre-wrap; word-break: break-all;
  max-height: 320px; overflow: auto; margin: 0;
}
.upload-icon { font-size: 28px; color: #0052d9; }
.upload-text { font-size: 13px; color: #1d2129; }
.upload-tip { font-size: 12px; color: #a9aeb8; }
.dbg-hint-box {
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4e5969;
  background: #f2f5fa; border-radius: 6px; padding: 8px 10px; margin-top: 6px;
}
</style>
