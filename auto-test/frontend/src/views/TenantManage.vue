<template>
  <div>
    <t-card>
      <template #header>
        <div class="card-header">
          <span>租户管理</span>
          <t-button theme="primary" @click="showCreateDialog">新增租户</t-button>
        </div>
      </template>

      <div class="filter-bar">
        <t-input v-model="filter.keyword" placeholder="搜索编码或名称..." clearable style="width:200px" />
        <t-select v-model="filter.status" placeholder="状态" clearable style="width:120px;margin-left:10px">
          <t-option label="启用" :value="1" />
          <t-option label="禁用" :value="0" />
        </t-select>
        <t-button theme="primary" style="margin-left:10px" @click="loadData">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <t-table
        :data="list"
        :columns="columns"
        row-key="id"
        bordered
        stripe
        style="margin-top:15px"
      >
        <template #status="{ row }">
          <t-tag :theme="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </t-tag>
        </template>
        <template #createTime="{ row }">
          {{ formatTime(row.createTime) }}
        </template>
        <template #operate="{ row }">
          <ActionMenu
            :items="[
              { label: '编辑', command: 'edit', icon: SettingIcon },
              { label: row.status === 1 ? '禁用' : '启用', command: 'toggle', icon: row.status === 1 ? ErrorTriangleFilledIcon : CheckCircleFilledIcon },
              { label: '删除', command: 'delete', icon: DeleteIcon, divided: true, danger: true }
            ]"
            @command="(cmd) => onCommand(cmd, row)"
          />
        </template>
      </t-table>

      <div class="pagination-bar">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <!-- 新增/编辑对话框 -->
    <t-dialog v-model:visible="dialogVisible" :header="isEdit ? '编辑租户' : '新增租户'" width="480px">
      <t-form :data="form" label-width="80px">
        <t-form-item label="租户编码" name="tenantCode">
          <t-input v-model="form.tenantCode" :disabled="isEdit" placeholder="英文、数字、下划线" />
        </t-form-item>
        <t-form-item label="租户名称" name="tenantName">
          <t-input v-model="form.tenantName" placeholder="支持中英文" />
        </t-form-item>
        <t-form-item label="状态" name="status">
          <t-radio-group v-model="form.status">
            <t-radio-button :value="1">启用</t-radio-button>
            <t-radio-button :value="0">禁用</t-radio-button>
          </t-radio-group>
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="handleSubmit" :loading="submitting">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { SettingIcon, DeleteIcon, ErrorTriangleFilledIcon, CheckCircleFilledIcon } from 'tdesign-icons-vue-next'
import ActionMenu from '../components/ActionMenu.vue'
import api from '../api'

const list = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(10)
const filter = reactive({ keyword: '', status: null })
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const form = reactive({ id: null, tenantCode: '', tenantName: '', status: 1 })

const columns = [
  { colKey: 'tenantCode', title: '租户编码', width: 160 },
  { colKey: 'tenantName', title: '租户名称', width: 200 },
  { colKey: 'status', title: '状态', width: 80, align: 'center' },
  { colKey: 'createTime', title: '创建时间', width: 180 },
  { colKey: 'operate', title: '操作', width: 100, align: 'center' }
]

const formatTime = (t) => {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

const loadData = async () => {
  try {
    const res = await api.get('/tenant/list', {
      params: { keyword: filter.keyword || undefined, status: filter.status, pageNo: pageNo.value, pageSize: pageSize.value }
    })
    if (res.code === 200) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    MessagePlugin.error('加载失败')
  }
}

const resetFilter = () => {
  filter.keyword = ''
  filter.status = null
  pageNo.value = 1
  loadData()
}

const onPageChange = (info) => {
  pageNo.value = info.current
  pageSize.value = info.pageSize
  loadData()
}

const showCreateDialog = () => {
  isEdit.value = false
  Object.assign(form, { id: null, tenantCode: '', tenantName: '', status: 1 })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.tenantCode.trim()) return MessagePlugin.warning('请输入租户编码')
  if (!form.tenantName.trim()) return MessagePlugin.warning('请输入租户名称')
  submitting.value = true
  try {
    if (isEdit.value) {
      await api.put('/tenant/update', form)
      MessagePlugin.success('更新成功')
    } else {
      await api.post('/tenant/create', form)
      MessagePlugin.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    MessagePlugin.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const onCommand = async (cmd, row) => {
  if (cmd === 'edit') {
    isEdit.value = true
    Object.assign(form, { id: row.id, tenantCode: row.tenantCode, tenantName: row.tenantName, status: row.status })
    dialogVisible.value = true
  } else if (cmd === 'toggle') {
    const newStatus = row.status === 1 ? 0 : 1
    try {
      await api.put('/tenant/update', { id: row.id, status: newStatus })
      MessagePlugin.success(newStatus === 1 ? '已启用' : '已禁用')
      loadData()
    } catch (e) {
      MessagePlugin.error('操作失败')
    }
  } else if (cmd === 'delete') {
    const confirm = DialogPlugin.confirm({
      header: '确认删除',
      body: `确定要删除租户「${row.tenantName}」吗？此操作不可恢复。`,
      confirmBtn: { content: '删除', theme: 'danger' },
      onConfirm: async () => {
        try {
          await api.delete('/tenant/delete', { params: { id: row.id } })
          MessagePlugin.success('删除成功')
          loadData()
        } catch (e) {
          MessagePlugin.error('删除失败')
        }
      }
    })
  }
}

onMounted(loadData)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}
</style>
