<template>
  <div>
    <t-card>
      <template #header>
        <PageHeader title="用户管理" description="管理平台用户、角色与访问状态">
          <template #actions><t-button theme="primary" @click="showCreateDialog">新增用户</t-button></template>
        </PageHeader>
      </template>

      <div class="filter-bar">
        <t-input v-model="filter.keyword" placeholder="搜索用户名/姓名" clearable style="width:200px" />
        <t-button theme="primary" style="margin-left:10px" @click="loadUsers">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <t-table :data="users" :columns="userColumns" row-key="id" bordered stripe style="margin-top:15px">
        <template #role="{ row }">
          <t-tag :theme="row.role === 'ADMIN' ? 'danger' : 'default'">{{ row.role === 'ADMIN' ? '管理员' : '普通用户' }}</t-tag>
        </template>
        <template #status="{ row }">
          <t-tag :theme="row.status === 1 ? 'success' : 'default'">{{ row.status === 1 ? '启用' : '禁用' }}</t-tag>
        </template>
        <template #lastLoginTime="{ row }">{{ formatTime(row.lastLoginTime) }}</template>
        <template #createTime="{ row }">{{ formatTime(row.createTime) }}</template>
        <template #operate="{ row }">
          <ActionMenu
            :items="[
              { label: '编辑', command: 'edit', icon: EditIcon },
              { label: '删除', command: 'delete', icon: DeleteIcon, divided: true, danger: true }
            ]"
            @command="(cmd) => onUserCommand(cmd, row)"
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

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="500px">
      <t-form :data="form" label-width="100px">
        <t-form-item label="用户名" name="username">
          <t-input v-model="form.username" :disabled="isEdit" />
        </t-form-item>
        <t-form-item label="密码" name="password" v-if="!isEdit">
          <t-input v-model="form.password" type="password" />
          <PasswordStrength 
            v-if="form.password" 
            :password="form.password" 
            :show-requirements="true"
          />
        </t-form-item>
        <t-form-item label="密码" name="password" v-else>
          <t-input v-model="form.password" type="password" placeholder="留空不修改" />
          <PasswordStrength 
            v-if="form.password" 
            :password="form.password" 
            :show-requirements="true"
          />
        </t-form-item>
        <t-form-item label="显示名称" name="displayName">
          <t-input v-model="form.displayName" />
        </t-form-item>
        <t-form-item label="角色" name="role">
          <t-select v-model="form.role">
            <t-option label="管理员" value="ADMIN" />
            <t-option label="普通用户" value="USER" />
          </t-select>
        </t-form-item>
        <t-form-item label="状态" name="status" v-if="isEdit">
          <t-switch v-model="form.status" :custom-value="[1, 0]" />
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
import { EditIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'
import PasswordStrength from '../components/PasswordStrength.vue'
import PageHeader from '../components/PageHeader.vue'

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

const userColumns = [
  { colKey: 'username', title: '用户名', width: 150 },
  { colKey: 'displayName', title: '显示名称', width: 150 },
  { colKey: 'role', title: '角色', width: 100 },
  { colKey: 'status', title: '状态', width: 80 },
  { colKey: 'lastLoginTime', title: '最后登录', width: 180 },
  { colKey: 'createTime', title: '创建时间', width: 180 },
  { colKey: 'operate', title: '操作', width: 80, fixed: 'right', align: 'center', className: 'action-column' }
]

const loadUsers = async () => {
  const params = { ...filter.value, pageNo: pageNo.value, pageSize: pageSize.value }
  if (!params.keyword) delete params.keyword
  const res = await api.get('/user/list', { params })
  users.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const onPageChange = (pageInfo) => {
  pageNo.value = pageInfo.current
  pageSize.value = pageInfo.pageSize
  loadUsers()
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
    MessagePlugin.warning('请输入用户名')
    return
  }
  if (!isEdit.value && !form.value.password) {
    MessagePlugin.warning('请输入密码')
    return
  }
  
  // 验证密码强度
  if (form.value.password) {
    try {
      const res = await api.post('/user/validate-password', { password: form.value.password })
      if (!res.data.valid) {
        MessagePlugin.error(res.data.message)
        return
      }
    } catch (e) {
      MessagePlugin.error('密码验证失败')
      return
    }
  }
  
  if (isEdit.value) {
    await api.put('/user/update?id=' + editId.value, form.value)
    MessagePlugin.success('编辑成功')
  } else {
    await api.post('/user/create', form.value)
    MessagePlugin.success('创建成功')
  }
  dialogVisible.value = false
  loadUsers()
}

const deleteUser = (id) => {
  const dialog = DialogPlugin.confirm({
    header: '提示',
    body: '确定删除该用户？',
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      dialog.hide()
      await api.delete('/user/delete', { params: { id } })
      MessagePlugin.success('删除成功')
      loadUsers()
    }
  })
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
