<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>定时任务管理</span>
          <el-button type="primary" @click="showCreateDialog">新增任务</el-button>
        </div>
      </template>

      <el-table :data="tasks" border stripe style="margin-top:15px">
        <el-table-column prop="taskName" label="任务名称" width="180" />
        <el-table-column label="任务类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.taskType === 'SINGLE' ? 'primary' : 'success'">
              {{ row.taskType === 'SINGLE' ? '单链路' : '按分类' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="chainCode" label="链路编码" width="180">
          <template #default="{ row }">{{ row.chainCode || '-' }}</template>
        </el-table-column>
        <el-table-column label="调度方式" width="200">
          <template #default="{ row }">
            <span v-if="row.cronExpression">Cron: {{ row.cronExpression }}</span>
            <span v-else-if="row.intervalMinutes">间隔: {{ row.intervalMinutes }}分钟</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" :active-value="1" :inactive-value="0" @change="toggleTask(row)" />
          </template>
        </el-table-column>
        <el-table-column label="上次执行" width="180">
          <template #default="{ row }">{{ formatTime(row.lastRunTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center" class-name="action-column">
          <template #default="{ row }">
            <ActionMenu
              :items="[
                { label: '立即执行', command: 'trigger', icon: VideoPlay },
                { label: '编辑', command: 'edit', icon: Edit, divided: true },
                { label: '删除', command: 'delete', icon: Delete, danger: true }
              ]"
              @command="(cmd) => onTaskCommand(cmd, row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadTasks"
          @current-change="loadTasks"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务名称">
          <el-input v-model="form.taskName" />
        </el-form-item>
        <el-form-item label="任务类型">
          <el-radio-group v-model="form.taskType">
            <el-radio label="SINGLE">单链路</el-radio>
            <el-radio label="CATEGORY">按分类</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="链路编码" v-if="form.taskType === 'SINGLE'">
          <el-input v-model="form.chainCode" placeholder="如 CHAIN_694346B3B0" />
        </el-form-item>
        <el-form-item label="选择分类" v-if="form.taskType === 'CATEGORY'">
          <el-cascader
            v-model="form.categoryId"
            :options="categoryTree"
            :props="{ value: 'id', label: 'categoryName', children: 'children', emitPath: false }"
            placeholder="选择要执行的分类"
            style="width:100%"
            clearable
          />
          <div class="form-hint">选择分类后，该分类下的所有链路将被执行</div>
        </el-form-item>
        <el-form-item label="Cron表达式">
          <el-input v-model="form.cronExpression" placeholder="如 0 0 2 * * ?" />
          <div class="form-hint">常用：0 0 2 * * ? (每天凌晨2点)</div>
        </el-form-item>
        <el-form-item label="间隔(分钟)">
          <el-input-number v-model="form.intervalMinutes" :min="1" placeholder="与Cron二选一" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, VideoPlay } from '@element-plus/icons-vue'
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

const loadTasks = async () => {
  const res = await api.get('/task/list', { params: { pageNo: pageNo.value, pageSize: pageSize.value } })
  tasks.value = res.data?.list || []
  total.value = res.data?.total || 0
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
    ElMessage.warning('请输入任务名称')
    return
  }
  if (isEdit.value) {
    await api.put('/task/update?id=' + editId.value, form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/task/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadTasks()
}

const toggleTask = async (row) => {
  await api.put('/task/toggle?id=' + row.id)
  ElMessage.success(row.enabled ? '已启用' : '已禁用')
}

const triggerTask = async (id) => {
  await api.post('/task/trigger?id=' + id)
  ElMessage.success('任务已触发')
  loadTasks()
}

const deleteTask = async (id) => {
  await ElMessageBox.confirm('确定删除该任务？', '提示', { type: 'warning' })
  await api.delete('/task/delete', { params: { id } })
  ElMessage.success('删除成功')
  loadTasks()
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
