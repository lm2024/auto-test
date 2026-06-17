<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>测试账号管理</span>
          <el-button type="primary" @click="showCreateDialog">新增账号</el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-input v-model="filter.systemName" placeholder="所属系统" clearable style="width:200px" />
        <el-select v-model="filter.status" placeholder="状态" clearable style="width:150px;margin-left:10px">
          <el-option label="可用" :value="1" />
          <el-option label="锁定" :value="2" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" style="margin-left:10px" @click="loadAccounts">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="accounts" border stripe style="margin-top:15px">
        <el-table-column prop="accountCode" label="账号编码" width="140" />
        <el-table-column prop="accountName" label="显示名称" width="150" />
        <el-table-column prop="systemName" label="所属系统" width="120" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column label="密码" width="120">
          <template #default="{ row }">
            <span style="color:#999">••••••</span>
          </template>
        </el-table-column>
        <el-table-column prop="authType" label="认证类型" width="100" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : row.status === 2 ? 'warning' : 'info'">
              {{ row.status === 1 ? '可用' : row.status === 2 ? '锁定' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editAccount(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteAccount(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="账号编码">
          <el-input v-model="form.accountCode" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="form.accountName" />
        </el-form-item>
        <el-form-item label="所属系统">
          <el-input v-model="form.systemName" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" :placeholder="isEdit ? '留空不修改' : ''" />
        </el-form-item>
        <el-form-item label="认证类型">
          <el-select v-model="form.authType">
            <el-option label="PASSWORD" value="PASSWORD" />
            <el-option label="SSO" value="SSO" />
            <el-option label="TOKEN" value="TOKEN" />
          </el-select>
        </el-form-item>
        <el-form-item label="认证配置">
          <el-input v-model="form.authConfig" type="textarea" :rows="3" placeholder="JSON格式，如SSO登录地址" />
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

const accounts = ref([])
const filter = ref({ systemName: '', status: null })
const dialogVisible = ref(false)
const dialogTitle = ref('新增账号')
const isEdit = ref(false)
const form = ref({
  accountCode: '', accountName: '', systemName: '', username: '', password: '', authType: 'PASSWORD', authConfig: ''
})

const loadAccounts = async () => {
  const res = await api.get('/account/list', { params: filter.value })
  accounts.value = res.data || []
}

const resetFilter = () => {
  filter.value = { systemName: '', status: null }
  loadAccounts()
}

const showCreateDialog = () => {
  dialogTitle.value = '新增账号'
  isEdit.value = false
  form.value = { accountCode: '', accountName: '', systemName: '', username: '', password: '', authType: 'PASSWORD', authConfig: '' }
  dialogVisible.value = true
}

const editAccount = (row) => {
  dialogTitle.value = '编辑账号'
  isEdit.value = true
  form.value = { ...row, password: '' }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.accountCode || !form.value.accountName || !form.value.username) {
    ElMessage.warning('请填写必填字段')
    return
  }
  if (isEdit.value) {
    await api.put('/account/update?id=' + form.value.id, form.value)
    ElMessage.success('编辑成功')
  } else {
    if (!form.value.password) {
      ElMessage.warning('请输入密码')
      return
    }
    await api.post('/account/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadAccounts()
}

const deleteAccount = async (id) => {
  await ElMessageBox.confirm('确定删除该账号？', '提示', { type: 'warning' })
  await api.delete('/account/delete', { params: { id } })
  ElMessage.success('删除成功')
  loadAccounts()
}

onMounted(loadAccounts)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 16px;
  color: #1e1b4b;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  flex-wrap: wrap;
}
</style>