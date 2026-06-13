<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>测试链路管理</span>
          <el-button type="primary" @click="showCreateDialog">新增链路</el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-input v-model="filter.chainName" placeholder="链路名称" clearable style="width:200px" />
        <el-select v-model="filter.executeMode" placeholder="执行模式" clearable style="width:150px;margin-left:10px">
          <el-option label="全串行" :value="1" />
          <el-option label="分组并行" :value="2" />
        </el-select>
        <el-button type="primary" style="margin-left:10px" @click="loadChains">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span>已选 {{ selectedRows.length }} 条</span>
        <el-button type="success" size="small" @click="batchExecute">批量执行</el-button>
        <el-button type="danger" size="small" @click="batchDelete">批量删除</el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>

      <el-table :data="chains" border stripe style="margin-top:15px" @selection-change="handleSelectionChange" ref="tableRef">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="chainCode" label="链路编码" width="200" />
        <el-table-column prop="chainName" label="链路名称" width="200" />
        <el-table-column label="执行模式" width="120">
          <template #default="{ row }">
            <el-tag :type="row.executeMode === 1 ? 'primary' : 'warning'">
              {{ row.executeMode === 1 ? '全串行' : '分组并行' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="nodeCount" label="节点数" width="80" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="300">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push('/chain/edit/' + row.chainCode)">编排</el-button>
            <el-button size="small" type="success" @click="executeChain(row.chainCode)">执行</el-button>
            <el-button size="small" @click="copyChain(row.chainCode)">复制</el-button>
            <el-button size="small" @click="editChain(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteChain(row.chainCode)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="链路名称">
          <el-input v-model="form.chainName" />
        </el-form-item>
        <el-form-item label="执行模式">
          <el-select v-model="form.executeMode">
            <el-option label="全串行" :value="1" />
            <el-option label="分组并行" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" />
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
import api from '../api'

const chains = ref([])
const filter = ref({ chainName: '', executeMode: null })
const dialogVisible = ref(false)
const dialogTitle = ref('新增链路')
const form = ref({ chainName: '', executeMode: 1, description: '', isEdit: false })
const selectedRows = ref([])
const tableRef = ref(null)

const loadChains = async () => {
  const res = await api.get('/chain/list', { params: filter.value })
  chains.value = res.data || []
}

const resetFilter = () => {
  filter.value = { chainName: '', executeMode: null }
  loadChains()
}

const formatTime = (t) => {
  if (!t) return '-'
  return new Date(t).toLocaleString()
}

const showCreateDialog = () => {
  dialogTitle.value = '新增链路'
  form.value = { chainName: '', executeMode: 1, description: '', isEdit: false }
  dialogVisible.value = true
}

const editChain = (row) => {
  dialogTitle.value = '编辑链路'
  form.value = { ...row, isEdit: true }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.chainName) {
    ElMessage.warning('请输入链路名称')
    return
  }
  if (form.value.isEdit) {
    await api.post('/chain/edit', form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/chain/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadChains()
}

const copyChain = async (chainCode) => {
  await api.post('/chain/copy', { chainCode })
  ElMessage.success('复制成功')
  loadChains()
}

const deleteChain = async (chainCode) => {
  await ElMessageBox.confirm('确定删除该链路？关联节点将同步删除。', '提示', { type: 'warning' })
  await api.post('/chain/delete', null, { params: { chainCode } })
  ElMessage.success('删除成功')
  loadChains()
}

const executeChain = async (chainCode) => {
  const res = await api.post('/execute/run', { chainCode })
  ElMessage.success('执行已启动，执行ID: ' + res.data.executionId)
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
}

const batchDelete = async () => {
  if (!selectedRows.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条链路？关联节点将同步删除。`, '批量删除', { type: 'warning' })
  const chainCodes = selectedRows.value.map(r => r.chainCode)
  const res = await api.post('/chain/batchDelete', { chainCodes })
  ElMessage.success(`删除完成: 成功${res.data.successCount}条，失败${res.data.failCount}条`)
  clearSelection()
  loadChains()
}

const batchExecute = async () => {
  if (!selectedRows.value.length) return
  const chainCodes = selectedRows.value.map(r => r.chainCode)
  const res = await api.post('/execute/batchRun', { chainCodes })
  const results = res.data || []
  const started = results.filter(r => r.status === 'started').length
  const failed = results.filter(r => r.status === 'failed').length
  ElMessage.success(`执行启动: ${started}条成功，${failed}条失败`)
  clearSelection()
}

onMounted(loadChains)
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
}
.batch-bar {
  margin-top: 15px;
  padding: 10px 15px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.batch-bar span {
  color: #409eff;
  font-weight: 500;
}
</style>
