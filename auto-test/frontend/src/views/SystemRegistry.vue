<template>
  <div class="registry-page">
    <PageHeader title="系统注册表" description="维护内外网系统的域名 / IP 段规则，用于自动识别接口归属">
      <template #actions>
        <t-input v-model="testUrl" placeholder="输入 URL 试一下识别结果" style="width:320px" clearable />
        <t-button theme="default" variant="outline" :loading="classifying" @click="doClassify">识别</t-button>
        <t-button theme="primary" @click="openEdit(null)">
          <template #icon><AddIcon /></template>新增系统
        </t-button>
      </template>
    </PageHeader>

    <t-alert v-if="classifyResult" theme="info" class="classify-alert" :close="true" @close="classifyResult = null">
      识别结果：<b>{{ scopeLabel(classifyResult.scope) }}</b>
      <span v-if="classifyResult.systemName"> · 所属系统 {{ classifyResult.systemName }}（{{ classifyResult.systemCode }}）</span>
    </t-alert>

    <t-table :data="list" :columns="columns" row-key="id" :loading="loading" size="medium" stripe>
      <template #scope="{ row }">
        <t-tag size="small" variant="light" :theme="scopeTheme(row.scope)">{{ scopeLabel(row.scope) }}</t-tag>
      </template>
      <template #domainPatterns="{ row }">
        <span class="mono">{{ row.domainPatterns || '-' }}</span>
      </template>
      <template #ipRanges="{ row }">
        <span class="mono">{{ row.ipRanges || '-' }}</span>
      </template>
      <template #op="{ row }">
        <t-button size="small" variant="text" theme="primary" @click="openEdit(row)">编辑</t-button>
        <t-button size="small" variant="text" theme="danger" @click="remove(row)">删除</t-button>
      </template>
    </t-table>

    <t-dialog
      v-model:visible="editVisible"
      :header="form.id ? '编辑系统' : '新增系统'"
      width="560px"
      @confirm="save"
    >
      <t-form label-width="92px">
        <t-form-item label="系统编码">
          <t-input v-model="form.systemCode" placeholder="如 ORDER_SERVICE" />
        </t-form-item>
        <t-form-item label="系统名称">
          <t-input v-model="form.systemName" placeholder="如 订单中心" />
        </t-form-item>
        <t-form-item label="归属">
          <t-select v-model="form.scope">
            <t-option label="内网 INTERNAL" value="INTERNAL" />
            <t-option label="外网 EXTERNAL" value="EXTERNAL" />
            <t-option label="未知 UNKNOWN" value="UNKNOWN" />
          </t-select>
        </t-form-item>
        <t-form-item label="域名规则">
          <t-textarea v-model="form.domainPatterns" :autosize="{ minRows: 2 }" placeholder="多个用逗号分隔，支持 *.example.com" />
        </t-form-item>
        <t-form-item label="IP 段">
          <t-textarea v-model="form.ipRanges" :autosize="{ minRows: 2 }" placeholder="多个用逗号分隔，如 10.0.0.0/8,192.168.0.0/16" />
        </t-form-item>
        <t-form-item label="分类">
          <t-input v-model="form.category" placeholder="如 支付 / 基础服务" />
        </t-form-item>
        <t-form-item label="说明">
          <t-input v-model="form.description" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { AddIcon } from 'tdesign-icons-vue-next'
import registryApi from '../api/registry'
import PageHeader from '../components/PageHeader.vue'

const columns = [
  { colKey: 'systemCode', title: '系统编码', width: 160, ellipsis: true },
  { colKey: 'systemName', title: '系统名称', width: 150, ellipsis: true },
  { colKey: 'scope', title: '归属', width: 90 },
  { colKey: 'domainPatterns', title: '域名规则', ellipsis: true },
  { colKey: 'ipRanges', title: 'IP 段', ellipsis: true },
  { colKey: 'category', title: '分类', width: 110, ellipsis: true },
  { colKey: 'op', title: '操作', width: 120, fixed: 'right' }
]

const list = ref([])
const loading = ref(false)
const editVisible = ref(false)
const testUrl = ref('')
const classifying = ref(false)
const classifyResult = ref(null)

const form = reactive({
  id: null, systemCode: '', systemName: '', scope: 'INTERNAL',
  domainPatterns: '', ipRanges: '', category: '', description: ''
})

const SCOPE_LABEL = { INTERNAL: '内网', EXTERNAL: '外网', UNKNOWN: '未知' }
function scopeLabel(s) { return SCOPE_LABEL[s] || s || '未知' }
function scopeTheme(s) {
  if (s === 'INTERNAL') return 'primary'
  if (s === 'EXTERNAL') return 'warning'
  return 'default'
}

async function load() {
  loading.value = true
  try {
    const res = await registryApi.list()
    if (res.code === 200) list.value = res.data || []
    else MessagePlugin.error(res.message || '加载失败')
  } catch (e) {
    MessagePlugin.error('加载失败: ' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

function openEdit(row) {
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      id: null, systemCode: '', systemName: '', scope: 'INTERNAL',
      domainPatterns: '', ipRanges: '', category: '', description: ''
    })
  }
  editVisible.value = true
}

async function save() {
  if (!form.systemCode || !form.systemName) {
    MessagePlugin.warning('系统编码与名称不能为空')
    return
  }
  try {
    const res = await registryApi.save({ ...form })
    if (res.code === 200) {
      MessagePlugin.success('保存成功')
      editVisible.value = false
      load()
    } else {
      MessagePlugin.error(res.message || '保存失败')
    }
  } catch (e) {
    MessagePlugin.error('保存失败: ' + (e.response?.data?.message || e.message))
  }
}

function remove(row) {
  const d = DialogPlugin.confirm({
    header: '删除确认',
    body: `确定删除系统「${row.systemName}」？删除后相关接口将变为未知归属。`,
    onConfirm: async () => {
      try {
        const res = await registryApi.remove(row.id)
        if (res.code === 200) {
          MessagePlugin.success('已删除')
          load()
        } else {
          MessagePlugin.error(res.message || '删除失败')
        }
      } catch (e) {
        MessagePlugin.error('删除失败: ' + (e.response?.data?.message || e.message))
      }
      d.hide()
    }
  })
}

async function doClassify() {
  if (!testUrl.value) {
    MessagePlugin.warning('请输入 URL')
    return
  }
  classifying.value = true
  try {
    const res = await registryApi.classify(testUrl.value)
    if (res.code === 200) classifyResult.value = res.data
    else MessagePlugin.error(res.message || '识别失败')
  } catch (e) {
    MessagePlugin.error('识别失败: ' + (e.response?.data?.message || e.message))
  } finally {
    classifying.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.registry-page { padding: 20px 24px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1d2129; }
.page-desc { font-size: 13px; color: #86909c; margin-top: 4px; }
.head-ops { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.classify-alert { margin-bottom: 12px; }
.mono { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; color: #4e5969; }
</style>
