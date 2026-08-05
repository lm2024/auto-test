<template>
  <t-dialog
    :visible="visible"
    header="导入接口"
    width="720px"
    :footer="false"
    @close="emit('close')"
  >
    <t-tabs v-model="tab">
      <!-- Swagger -->
      <t-tab-panel label="Swagger / OpenAPI" value="swagger">
        <div class="imp">
          <t-input v-model="swaggerUrl" placeholder="https://example.com/v3/api-docs" clearable />
          <t-button theme="primary" :loading="loading" @click="parseSwagger">解析</t-button>
        </div>
        <PreviewList :list="swaggerResult" />
        <t-button
          v-if="swaggerResult.length"
          theme="primary"
          block
          style="margin-top:12px"
          @click="doImport(swaggerResult)"
        >导入 {{ swaggerResult.length }} 个接口</t-button>
      </t-tab-panel>

      <!-- JSON 文件 -->
      <t-tab-panel label="JSON 文件" value="file">
        <t-upload
          v-model="jsonFileList"
          theme="file"
          :auto-upload="false"
          accept=".json"
          :max="1"
          @change="onJsonFile"
        />
        <PreviewList :list="jsonPreview" />
        <t-button
          v-if="jsonPreview.length"
          theme="primary"
          block
          style="margin-top:12px"
          @click="doImport(jsonPreview)"
        >导入 {{ jsonPreview.length }} 个接口</t-button>
      </t-tab-panel>

      <!-- cURL -->
      <t-tab-panel label="cURL" value="curl">
        <t-textarea v-model="curlCommand" :autosize="{ minRows: 6, maxRows: 12 }" placeholder="粘贴 cURL 命令" />
        <t-button theme="primary" block style="margin-top:12px" :loading="loading" @click="importCurl">解析并导入</t-button>
      </t-tab-panel>

      <!-- 粘贴 JSON -->
      <t-tab-panel label="粘贴 JSON" value="paste">
        <t-textarea v-model="pasteJson" :autosize="{ minRows: 6, maxRows: 12 }" placeholder='[{"nodeName":"登录","method":"POST","url":"..."}]' />
        <t-button theme="primary" block style="margin-top:12px" :loading="loading" @click="importPaste">解析并导入</t-button>
      </t-tab-panel>
    </t-tabs>
  </t-dialog>
</template>

<script setup>
import { ref, h } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import nodeApi from '../../api/node'

const props = defineProps({
  visible: { type: Boolean, default: false },
  chainCode: { type: String, required: true }
})
const emit = defineEmits(['close', 'imported'])

// 轻量预览列表（避免再引入一个文件）
const PreviewList = {
  props: { list: { type: Array, default: () => [] } },
  setup(p) {
    return () =>
      p.list.length
        ? h(
            'div',
            { class: 'preview-list' },
            p.list.slice(0, 50).map((it, i) =>
              h('div', { class: 'preview-item', key: i }, [
                h('span', { class: 'pv-method' }, it.method),
                h('span', { class: 'pv-name' }, it.nodeName),
                h('span', { class: 'pv-url' }, it.url)
              ])
            )
          )
        : null
  }
}

const tab = ref('swagger')
const loading = ref(false)
const swaggerUrl = ref('')
const swaggerResult = ref([])
const jsonFileList = ref([])
const jsonPreview = ref([])
const curlCommand = ref('')
const pasteJson = ref('')

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']

function fromOpenApi(spec) {
  const result = []
  const paths = spec.paths || {}
  const baseUrl = spec.servers?.[0]?.url || ''
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, detail] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method.toLowerCase())) continue
      result.push({
        nodeName: detail.summary || detail.operationId || path,
        method: method.toUpperCase(),
        url: baseUrl + path,
        headers: JSON.stringify(
          detail.requestBody?.content?.['application/json'] ? { 'Content-Type': 'application/json' } : {}
        ),
        bodyData: ''
      })
    }
  }
  return result
}

async function parseSwagger() {
  if (!swaggerUrl.value) {
    MessagePlugin.warning('请输入 Swagger URL')
    return
  }
  loading.value = true
  try {
    const resp = await fetch(swaggerUrl.value)
    const spec = await resp.json()
    swaggerResult.value = fromOpenApi(spec)
    MessagePlugin.success(`解析到 ${swaggerResult.value.length} 个接口`)
  } catch (e) {
    MessagePlugin.error('解析失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

function parseImportData(data) {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      nodeName: item.nodeName || item.name || item.title || '未命名',
      method: (item.method || 'GET').toUpperCase(),
      url: item.url || item.request?.url || '',
      headers: typeof item.headers === 'string' ? item.headers : JSON.stringify(item.headers || {}),
      bodyData: item.bodyData || item.body || item.request?.body || ''
    }))
  }
  if (data.item || data.requests) {
    const items = data.item || data.requests || []
    return items.map((item) => ({
      nodeName: item.name || item.nodeName || '未命名',
      method: (item.request?.method || item.method || 'GET').toUpperCase(),
      url: item.request?.url || item.url || '',
      headers: JSON.stringify(item.request?.header || item.headers || {}),
      bodyData: item.request?.body?.raw || item.bodyData || ''
    }))
  }
  if (data.paths) return fromOpenApi(data)
  return []
}

function onJsonFile(files, context) {
  if (context?.trigger === 'remove') {
    jsonPreview.value = []
    return
  }
  const raw = context?.file?.raw || files?.[0]?.raw
  if (!raw) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      jsonPreview.value = parseImportData(JSON.parse(e.target.result))
      MessagePlugin.success(`解析到 ${jsonPreview.value.length} 个接口`)
    } catch (err) {
      MessagePlugin.error('JSON解析失败: ' + err.message)
    }
  }
  reader.readAsText(raw)
}

function parseCurl(cmd) {
  const tokens = cmd.replace(/\\\n/g, ' ').replace(/\\/g, ' ').split(/\s+/)
  let method = 'GET'
  let url = ''
  const headers = {}
  let body = ''
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].trim()
    if (t === '-X' && tokens[i + 1]) {
      method = tokens[++i].replace(/['"]/g, '').toUpperCase()
    } else if (t.startsWith('-H') && tokens[i + 1]) {
      const h = tokens[++i].replace(/^['"]|['"]$/g, '')
      const [k, ...v] = h.split(':')
      if (k) headers[k.trim()] = v.join(':').trim()
    } else if ((t === '-d' || t === '--data') && tokens[i + 1]) {
      body = tokens[++i].replace(/^['"]|['"]$/g, '')
      if (method === 'GET') method = 'POST'
    } else if (t.startsWith('http')) {
      url = t.replace(/['"]/g, '')
    }
  }
  let name = 'cURL导入'
  if (url) {
    try {
      name = new URL(url).pathname.split('/').filter(Boolean).pop() || 'cURL导入'
    } catch {
      name = 'cURL导入'
    }
  }
  return { nodeName: name, method, url, headers: JSON.stringify(headers), bodyData: body }
}

async function doImport(list) {
  const payload = list.map((item, i) => ({ ...item, sort: i + 1 }))
  try {
    const res = await nodeApi.importNodes(props.chainCode, payload)
    if (res.code === 200) {
      MessagePlugin.success(`导入 ${payload.length} 个接口成功`)
      emit('imported')
      emit('close')
    } else {
      MessagePlugin.error(res.message || '导入失败')
    }
  } catch (e) {
    MessagePlugin.error('导入失败: ' + (e.response?.data?.message || e.message))
  }
}

async function importCurl() {
  if (!curlCommand.value.trim()) {
    MessagePlugin.warning('请输入 cURL 命令')
    return
  }
  loading.value = true
  try {
    await doImport([parseCurl(curlCommand.value)])
  } finally {
    loading.value = false
  }
}

async function importPaste() {
  if (!pasteJson.value.trim()) {
    MessagePlugin.warning('请粘贴 JSON 数据')
    return
  }
  loading.value = true
  try {
    const data = JSON.parse(pasteJson.value)
    await doImport(parseImportData(Array.isArray(data) ? data : [data]))
  } catch (e) {
    MessagePlugin.error('JSON解析失败: ' + e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.imp { display: flex; gap: 8px; margin-bottom: 12px; }
:deep(.preview-list) {
  max-height: 280px; overflow: auto; border: 1px solid #e5e6eb;
  border-radius: 6px; margin-top: 12px;
}
:deep(.preview-item) {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border-bottom: 1px solid #f2f3f5; font-size: 12px;
}
:deep(.pv-method) { flex: 0 0 52px; font-weight: 700; color: #0052d9; }
:deep(.pv-name) { flex: 0 0 150px; color: #1d2129; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:deep(.pv-url) { flex: 1 1 auto; color: #86909c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
