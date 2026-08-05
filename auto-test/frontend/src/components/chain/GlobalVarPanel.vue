<template>
  <t-drawer :visible="visible" header="变量管理" size="620px" :footer="false" @close="emit('close')">
    <div class="gv-toolbar">
      <t-radio-group v-model="scopeFilter" size="small" @change="load">
        <t-radio-button value="">全部</t-radio-button>
        <t-radio-button value="GLOBAL">全局变量</t-radio-button>
        <t-radio-button value="CHAIN">链路变量</t-radio-button>
      </t-radio-group>
      <t-button theme="primary" size="small" @click="openEdit(null)">
        <template #icon><AddIcon /></template>新增变量
      </t-button>
    </div>

    <t-table
      :data="list"
      :columns="columns"
      row-key="id"
      size="small"
      :loading="loading"
      max-height="calc(100vh - 220px)"
    >
      <template #varScope="{ row }">
        <t-tag size="small" :theme="row.varScope === 'GLOBAL' ? 'primary' : 'default'" variant="light">
          {{ row.varScope === 'GLOBAL' ? '全局' : '链路' }}
        </t-tag>
      </template>
      <template #varValue="{ row }">
        <span v-if="row.isEncrypted === 1">••••••••</span>
        <span v-else class="gv-value">{{ row.varValue }}</span>
      </template>
      <template #op="{ row }">
        <t-button size="small" variant="text" theme="primary" @click="openEdit(row)">编辑</t-button>
        <t-button size="small" variant="text" theme="danger" @click="remove(row)">删除</t-button>
      </template>
    </t-table>

    <t-dialog
      v-model:visible="editVisible"
      :header="form.id ? '编辑变量' : '新增变量'"
      width="460px"
      @confirm="save"
    >
      <t-form label-width="80px">
        <t-form-item label="作用域">
          <t-select v-model="form.varScope">
            <t-option label="全局变量" value="GLOBAL" />
            <t-option label="链路变量" value="CHAIN" />
          </t-select>
        </t-form-item>
        <t-form-item v-if="form.varScope === 'CHAIN'" label="链路编码">
          <t-input v-model="form.chainCode" placeholder="留空则用当前链路" />
        </t-form-item>
        <t-form-item label="变量名">
          <t-input v-model="form.varName" placeholder="如 token" />
        </t-form-item>
        <t-form-item label="变量值">
          <t-input v-model="form.varValue" placeholder="变量值" />
        </t-form-item>
        <t-form-item label="类型">
          <t-select v-model="form.varType">
            <t-option label="字符串" value="STRING" />
            <t-option label="数字" value="NUMBER" />
            <t-option label="布尔" value="BOOLEAN" />
            <t-option label="JSON" value="JSON" />
          </t-select>
        </t-form-item>
        <t-form-item label="加密">
          <t-switch v-model="encrypted" />
        </t-form-item>
        <t-form-item label="说明">
          <t-input v-model="form.description" placeholder="用途说明" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </t-drawer>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { AddIcon } from 'tdesign-icons-vue-next'
import variableApi from '../../api/variable'

const props = defineProps({
  visible: { type: Boolean, default: false },
  chainCode: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const columns = [
  { colKey: 'varScope', title: '作用域', width: 80 },
  { colKey: 'varName', title: '变量名', width: 140, ellipsis: true },
  { colKey: 'varValue', title: '变量值', ellipsis: true },
  { colKey: 'varType', title: '类型', width: 80 },
  { colKey: 'op', title: '操作', width: 110, fixed: 'right' }
]

const list = ref([])
const loading = ref(false)
const scopeFilter = ref('')
const editVisible = ref(false)
const form = reactive({
  id: null, varScope: 'GLOBAL', chainCode: '', varName: '',
  varValue: '', varType: 'STRING', isEncrypted: 0, description: ''
})
const encrypted = computed({
  get: () => form.isEncrypted === 1,
  set: (v) => { form.isEncrypted = v ? 1 : 0 }
})

watch(() => props.visible, (v) => { if (v) load() })

async function load() {
  loading.value = true
  try {
    const res = await variableApi.list({ chainCode: props.chainCode, scope: scopeFilter.value })
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
      id: null, varScope: 'GLOBAL', chainCode: props.chainCode, varName: '',
      varValue: '', varType: 'STRING', isEncrypted: 0, description: ''
    })
  }
  editVisible.value = true
}

async function save() {
  if (!form.varName) {
    MessagePlugin.warning('变量名不能为空')
    return
  }
  const payload = { ...form }
  if (payload.varScope === 'CHAIN' && !payload.chainCode) payload.chainCode = props.chainCode
  if (payload.varScope === 'GLOBAL') payload.chainCode = null
  try {
    const res = await variableApi.save(payload)
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
    body: `确定删除变量「${row.varName}」？`,
    onConfirm: async () => {
      try {
        const res = await variableApi.remove(row.id)
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
</script>

<style scoped>
.gv-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.gv-value { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
</style>
