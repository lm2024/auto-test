<template>
  <div>
    <t-card>
      <template #header>
        <div class="card-header">
          <span>定时任务管理</span>
          <t-button theme="primary" @click="showCreateDialog">新增任务</t-button>
        </div>
      </template>

      <t-table :data="tasks" :columns="taskColumns" row-key="id" bordered stripe style="margin-top:15px">
        <template #taskType="{ row }">
          <t-tag :theme="row.taskType === 'SINGLE' ? 'primary' : 'success'">
            {{ row.taskType === 'SINGLE' ? '单链路' : '按分类' }}
          </t-tag>
        </template>
        <template #chainCode="{ row }">{{ row.chainCode || '-' }}</template>
        <template #schedule="{ row }">
          <span v-if="row.cronExpression">Cron: {{ row.cronExpression }}</span>
          <span v-else-if="row.intervalMinutes">间隔: {{ row.intervalMinutes }}分钟</span>
          <span v-else>-</span>
        </template>
        <template #enabled="{ row }">
          <t-switch v-model="row.enabled" :custom-value="[1, 0]" @change="toggleTask(row)" />
        </template>
        <template #lastRunTime="{ row }">{{ formatTime(row.lastRunTime) }}</template>
        <template #operate="{ row }">
          <ActionMenu
            :items="[
              { label: '立即执行', command: 'trigger', icon: PlayCircleIcon },
              { label: '编辑', command: 'edit', icon: EditIcon, divided: true },
              { label: '删除', command: 'delete', icon: DeleteIcon, danger: true }
            ]"
            @command="(cmd) => onTaskCommand(cmd, row)"
          />
        </template>
      </t-table>

      <div class="pagination-bar">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="600px">
      <t-form :data="form" label-width="100px">
        <t-form-item label="任务名称" name="taskName">
          <t-input v-model="form.taskName" />
        </t-form-item>
        <t-form-item label="任务类型" name="taskType">
          <t-radio-group v-model="form.taskType">
            <t-radio value="SINGLE">单链路</t-radio>
            <t-radio value="CATEGORY">按分类</t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="链路编码" name="chainCode" v-if="form.taskType === 'SINGLE'">
          <t-input v-model="form.chainCode" placeholder="如 CHAIN_694346B3B0" />
        </t-form-item>
        <t-form-item label="选择分类" name="categoryId" v-if="form.taskType === 'CATEGORY'">
          <t-cascader
            v-model="form.categoryId"
            :options="categoryTree"
            :keys="{ value: 'id', label: 'categoryName', children: 'children' }"
            placeholder="选择要执行的分类"
            style="width:100%"
            clearable
          />
          <div class="form-hint">选择分类后，该分类下的所有链路将被执行</div>
        </t-form-item>
        <t-form-item label="Cron表达式" name="cronExpression">
          <t-input v-model="form.cronExpression" placeholder="如 0 0 2 * * ?" />
          <div class="form-hint">常用：0 0 2 * * ? (每天凌晨2点)</div>
        </t-form-item>
        <t-form-item label="间隔(分钟)" name="intervalMinutes">
          <t-input-number v-model="form.intervalMinutes" :min="1" placeholder="与Cron二选一" />
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { EditIcon, DeleteIcon, PlayCircleIcon } from 'tdesign-icons-vue-next'
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'

const tasks = ref([])
const categoryTree = ref([])
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增任务')
const isEdit = ref(false)
const editId = ref(null)
const form = ref({ taskName: '', taskType: 'SINGLE', chainCode: '', categoryId: null, cronExpression: '', intervalMinutes: null })

const taskColumns = [
  { colKey: 'taskName', title: '任务名称', width: 180 },
  { colKey: 'taskType', title: '任务类型', width: 120 },
  { colKey: 'chainCode', title: '链路编码', width: 180 },
  { colKey: 'schedule', title: '调度方式', width: 200 },
  { colKey: 'enabled', title: '状态', width: 80 },
  { colKey: 'lastRunTime', title: '上次执行', width: 180 },
  { colKey: 'operate', title: '操作', width: 80, fixed: 'right', align: 'center', className: 'action-column' }
]

const loadTasks = async () => {
  const res = await api.get('/task/list', { params: { pageNo: pageNo.value, pageSize: pageSize.value } })
  tasks.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const onPageChange = (pageInfo) => {
  pageNo.value = pageInfo.current
  pageSize.value = pageInfo.pageSize
  loadTasks()
}

const formatTime = (t) => t ? new Date(t).toLocaleString() : '-'

const showCreateDialog = () => {
  dialogTitle.value = '新增任务'
  isEdit.value = false
  editId.value = null
  form.value = { taskName: '', taskType: 'SINGLE', chainCode: '', categoryId: null, cronExpression: '', intervalMinutes: null }
  dialogVisible.value = true
}

const editTask = (row) => {
  dialogTitle.value = '编辑任务'
  isEdit.value = true
  editId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.taskName) {
    MessagePlugin.warning('请输入任务名称')
    return
  }
  if (isEdit.value) {
    await api.put('/task/update?id=' + editId.value, form.value)
    MessagePlugin.success('编辑成功')
  } else {
    await api.post('/task/create', form.value)
    MessagePlugin.success('创建成功')
  }
  dialogVisible.value = false
  loadTasks()
}

const toggleTask = async (row) => {
  await api.put('/task/toggle?id=' + row.id)
  MessagePlugin.success(row.enabled ? '已启用' : '已禁用')
}

const triggerTask = async (id) => {
  await api.post('/task/trigger?id=' + id)
  MessagePlugin.success('任务已触发')
  loadTasks()
}

const deleteTask = (id) => {
  const dialog = DialogPlugin.confirm({
    header: '提示',
    body: '确定删除该任务？',
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      dialog.hide()
      await api.delete('/task/delete', { params: { id } })
      MessagePlugin.success('删除成功')
      loadTasks()
    }
  })
}

const onTaskCommand = (cmd, row) => {
  switch (cmd) {
    case 'trigger': triggerTask(row.id); break
    case 'edit': editTask(row); break
    case 'delete': deleteTask(row.id); break
  }
}

onMounted(async () => {
  loadTasks()
  try {
    const res = await api.get('/category/tree')
    categoryTree.value = res.data || []
  } catch (e) {
    console.error('Failed to load category tree', e)
  }
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}
:deep(.el-table .action-column),
:deep(.el-table td.action-column) {
  background: var(--surface, #ffffff) !important;
  padding: 8px 0 !important;
  height: auto !important;
}
:deep(.el-table .el-table__fixed-right-wrapper) {
  background: var(--surface, #ffffff) !important;
}
:deep(.el-table .el-table__fixed-right::before) {
  display: none !important;
}
.form-hint {
  font-size: 12px;
  color: var(--text-mute);
  margin-top: 4px;
}
</style>
