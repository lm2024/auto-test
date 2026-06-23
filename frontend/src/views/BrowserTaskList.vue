<template>
  <div class="browser-task-list">
    <div class="page-header">
      <div class="header-left">
        <h2>浏览器自动化</h2>
        <span class="header-sub">管理 Playwright 浏览器自动化测试任务</span>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="openCreate" :icon="Plus">新建任务</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="filter.taskName" placeholder="任务名称" clearable style="width:200px" @clear="loadData" @keyup.enter="loadData" />
      <el-select v-model="filter.status" placeholder="状态" clearable style="width:130px" @change="loadData">
        <el-option label="启用" value="ENABLED" />
        <el-option label="禁用" value="DISABLED" />
      </el-select>
      <el-button @click="loadData" :icon="Search">搜索</el-button>
    </div>

    <el-table :data="tableData" v-loading="loading" stripe style="width:100%">
      <el-table-column prop="taskName" label="任务名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="targetUrl" label="目标URL" min-width="200" show-overflow-tooltip />
      <el-table-column prop="stepCount" label="步骤数" width="80" align="center" />
      <el-table-column prop="lastExecStatus" label="最近执行" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.lastExecStatus" :type="statusType(row.lastExecStatus)" size="small">
            {{ statusText(row.lastExecStatus) }}
          </el-tag>
          <span v-else style="color:#9ca3af">未执行</span>
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" label="更新时间" width="160" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="success" size="small" @click="runTask(row)">执行</el-button>
          <el-button link type="warning" size="small" @click="openSchedule(row)">定时</el-button>
          <el-button link type="danger" size="small" @click="deleteTask(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="filter.pageNo"
        v-model:page-size="filter.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @change="loadData"
      />
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑任务' : '新建任务'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="100px">
        <el-form-item label="任务名称" required>
          <el-input v-model="form.taskName" placeholder="如：登录流程测试" />
        </el-form-item>
        <el-form-item label="目标URL">
          <el-input v-model="form.targetUrl" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="任务描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTask" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 定时配置对话框 -->
    <el-dialog v-model="scheduleVisible" title="定时执行配置" width="500px" destroy-on-close>
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="启用定时">
          <el-switch v-model="scheduleForm.enabled" />
        </el-form-item>
        <el-form-item label="Cron表达式">
          <el-input v-model="scheduleForm.cronExpression" placeholder="0 0 9 * * ? (每天9点)" />
          <div class="cron-hint">示例：0 0 9 * * ? (每天9点)、0 */30 * * * ? (每30分钟)</div>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="scheduleForm.scheduleName" placeholder="定时任务名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule">保存</el-button>
        <el-button v-if="scheduleForm.id" type="danger" @click="deleteSchedule">删除定时</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { browserApi } from '../api/browser'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const tableData = ref([])
const total = ref(0)
const isEdit = ref(false)
const dialogVisible = ref(false)
const scheduleVisible = ref(false)
const currentTaskCode = ref('')

const filter = reactive({ taskName: '', status: '', pageNo: 1, pageSize: 10 })
const form = reactive({ taskCode: '', taskName: '', targetUrl: '', description: '' })
const scheduleForm = reactive({ taskCode: '', cronExpression: '', scheduleName: '', enabled: true })

const loadData = async () => {
  loading.value = true
  try {
    const res = await browserApi.taskList(filter)
    tableData.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e) {
    ElMessage.error('加载失败: ' + (e.response?.data?.message || e.message))
  } finally { loading.value = false }
}

const openCreate = () => {
  isEdit.value = false
  Object.assign(form, { taskCode: '', taskName: '', targetUrl: '', description: '' })
  dialogVisible.value = true
}

const openEdit = (row) => {
  isEdit.value = true
  Object.assign(form, { taskCode: row.taskCode, taskName: row.taskName, targetUrl: row.targetUrl, description: row.description })
  dialogVisible.value = true
}

const saveTask = async () => {
  if (!form.taskName) { ElMessage.warning('请输入任务名称'); return }
  saving.value = true
  try {
    if (isEdit.value) {
      await browserApi.taskUpdate(form)
      ElMessage.success('更新成功')
    } else {
      await browserApi.taskCreate(form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally { saving.value = false }
}

const deleteTask = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该任务？所有步骤将被删除。', '确认删除', { type: 'warning' })
    await browserApi.taskDelete(row.taskCode)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) { /* cancelled */ }
}

const runTask = async (row) => {
  try {
    const res = await browserApi.taskExecute(row.taskCode)
    const execId = res.data?.executionId
    ElMessage.success('执行已启动')
    if (execId) router.push(`/browser/exec/${execId}`)
  } catch (e) {
    ElMessage.error('执行失败: ' + (e.response?.data?.message || e.message))
  }
}

const openSchedule = async (row) => {
  currentTaskCode.value = row.taskCode
  try {
    const res = await browserApi.scheduleGet(row.taskCode)
    if (res.data) {
      Object.assign(scheduleForm, res.data)
    } else {
      Object.assign(scheduleForm, { id: '', taskCode: row.taskCode, cronExpression: '', scheduleName: '', enabled: true })
    }
  } catch {
    Object.assign(scheduleForm, { id: '', taskCode: row.taskCode, cronExpression: '', scheduleName: '', enabled: true })
  }
  scheduleVisible.value = true
}

const saveSchedule = async () => {
  try {
    scheduleForm.taskCode = currentTaskCode.value
    await browserApi.scheduleSave(scheduleForm)
    ElMessage.success('定时配置保存成功')
    scheduleVisible.value = false
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  }
}

const deleteSchedule = async () => {
  try {
    await ElMessageBox.confirm('确定删除定时配置？', '确认', { type: 'warning' })
    await browserApi.scheduleDelete(currentTaskCode.value)
    ElMessage.success('已删除')
    scheduleVisible.value = false
  } catch (e) { /* cancelled */ }
}

const statusType = (s) => ({ SUCCESS: 'success', FAILED: 'danger', RUNNING: 'warning' }[s] || 'info')
const statusText = (s) => ({ SUCCESS: '成功', FAILED: '失败', RUNNING: '运行中' }[s] || s)

onMounted(loadData)
</script>

<style scoped>
.browser-task-list { display: flex; flex-direction: column; gap: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); border: 1px solid rgba(99,102,241,0.08); border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.header-left h2 { font-size: 20px; font-weight: 700; color: #1e1b4b; margin: 0; }
.header-sub { font-size: 13px; color: #6b7280; margin-top: 4px; display: block; }
.filter-bar { display: flex; gap: 12px; align-items: center; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
.cron-hint { font-size: 12px; color: #9ca3af; margin-top: 6px; }
:deep(.el-table) { border-radius: 12px; overflow: hidden; }
:deep(.el-table th) { background: rgba(99,102,241,0.04); color: #4338ca; font-weight: 600; }
</style>
