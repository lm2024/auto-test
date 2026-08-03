<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="showCreateDialog">新增用户</el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-input v-model="filter.keyword" placeholder="搜索用户名/姓名" clearable style="width:200px" />
        <el-button type="primary" style="margin-left:10px" @click="loadUsers">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="users" border stripe style="margin-top:15px">
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="displayName" label="显示名称" width="150" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'ADMIN' ? 'danger' : ''">{{ row.role === 'ADMIN' ? '管理员' : '普通用户' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
          <template #default="{ row }">{{ formatTime(row.lastLoginTime) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center" class-name="action-column">
          <template #default="{ row }">
            <ActionMenu
              :items="[
                { label: '编辑', command: 'edit', icon: Edit },
                { label: '删除', command: 'delete', icon: Delete, divided: true, danger: true }
              ]"
              @command="(cmd) => onUserCommand(cmd, row)"
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
          @size-change="loadUsers"
          @current-change="loadUsers"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="密码" v-if="!isEdit">
          <el-input v-model="form.password" type="password" show-password />
          <PasswordStrength 
            v-if="form.password" 
            :password="form.password" 
            :show-requirements="true"
          />
        </el-form-item>
        <el-form-item label="密码" v-else>
          <el-input v-model="form.password" type="password" show-password placeholder="留空不修改" />
          <PasswordStrength 
            v-if="form.password" 
            :password="form.password" 
            :show-requirements="true"
          />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="form.displayName" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role">
            <el-option label="管理员" value="ADMIN" />
            <el-option label="普通用户" value="USER" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
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
import { Edit, Delete } from '@element-plus/icons-vue'
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'
import PasswordStrength from '../components/PasswordStrength.vue'

const users = ref([])
const filter = ref({ keyword: '' })
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const isEdit = ref(false)
const editId = ref(null)
const form = ref({ username: '', password: '', displayName: '', role: 'USER', status: 1 })

const loadUsers = async () => {
  const params = { ...filter.value, pageNo: pageNo.value, pageSize: pageSize.value }
  if (!params.keyword) delete params.keyword
  const res = await api.get('/user/list', { params })
  users.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const resetFilter = () => {
  filter.value = { keyword: '' }
  pageNo.value = 1
  loadUsers()
}

const formatTime = (t) => t ? new Date(t).toLocaleString() : '-'

const showCreateDialog = () => {
  dialogTitle.value = '新增用户'
  isEdit.value = false
  editId.value = null
  form.value = { username: '', password: '', displayName: '', role: 'USER', status: 1 }
  dialogVisible.value = true
}

const editUser = (row) => {
  dialogTitle.value = '编辑用户'
  isEdit.value = true
  editId.value = row.id
  form.value = { username: row.username, password: '', displayName: row.displayName, role: row.role, status: row.status }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.username) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!isEdit.value && !form.value.password) {
    ElMessage.warning('请输入密码')
    return
  }
  
  // 验证密码强度
  if (form.value.password) {
    try {
      const res = await api.post('/user/validate-password', { password: form.value.password })
      if (!res.data.valid) {
        ElMessage.error(res.data.message)
        return
      }
    } catch (e) {
      ElMessage.error('密码验证失败')
      return
    }
  }
  
  if (isEdit.value) {
    await api.put('/user/update?id=' + editId.value, form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/user/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadUsers()
}

const deleteUser = async (id) => {
  await ElMessageBox.confirm('确定删除该用户？', '提示', { type: 'warning' })
  await api.delete('/user/delete', { params: { id } })
  ElMessage.success('删除成功')
  loadUsers()
}

const onUserCommand = (cmd, row) => {
  switch (cmd) {
    case 'edit': editUser(row); break
    case 'delete': deleteUser(row.id); break
  }
}

onMounted(loadUsers)
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
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  flex-wrap: wrap;
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
</style>
