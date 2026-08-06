<template>
  <div>
    <t-card>
      <template #header>
        <div class="card-header">
          <span>测试账号管理</span>
          <t-button theme="primary" @click="showCreateDialog">新增账号</t-button>
        </div>
      </template>

      <div class="filter-bar">
        <t-input v-model="filter.systemName" placeholder="所属系统" clearable style="width:200px" />
        <t-select v-model="filter.status" placeholder="状态" clearable style="width:150px;margin-left:10px">
          <t-option label="可用" :value="1" />
          <t-option label="锁定" :value="2" />
          <t-option label="禁用" :value="0" />
        </t-select>
        <t-button theme="primary" style="margin-left:10px" @click="loadAccounts">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <t-table :data="accounts" :columns="accountColumns" row-key="id" bordered stripe style="margin-top:15px">
        <template #password>
          <span style="color:#999">••••••</span>
        </template>
        <template #status="{ row }">
          <t-tag :theme="row.status === 1 ? 'success' : row.status === 2 ? 'warning' : 'default'">
            {{ row.status === 1 ? '可用' : row.status === 2 ? '锁定' : '禁用' }}
          </t-tag>
        </template>
        <template #operate="{ row }">
          <ActionMenu
            :items="[
              { label: '编辑', command: 'edit', icon: EditIcon },
              { label: '删除', command: 'delete', icon: DeleteIcon, divided: true, danger: true }
            ]"
            @command="(cmd) => onAccountCommand(cmd, row)"
          />
        </template>
      </t-table>

      <div class="pagination-bar">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50, 100]"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="550px">
      <t-form :data="form" label-width="100px">
        <t-form-item label="账号编码" name="accountCode">
          <t-input v-model="form.accountCode" :disabled="isEdit" />
        </t-form-item>
        <t-form-item label="显示名称" name="accountName">
          <t-input v-model="form.accountName" />
        </t-form-item>
        <t-form-item label="所属系统" name="systemName">
          <t-input v-model="form.systemName" />
        </t-form-item>
        <t-form-item label="用户名" name="username">
          <t-input v-model="form.username" />
        </t-form-item>
        <t-form-item label="密码" name="password">
          <t-input v-model="form.password" type="password" :placeholder="isEdit ? '留空不修改' : ''" />
        </t-form-item>
        <t-form-item label="登录方式" name="loginType">
          <t-select v-model="form.loginType">
            <t-option label="HTTP 密码登录" value="HTTP" />
            <t-option label="Cookie 会话" value="COOKIE" />
            <t-option label="OAuth2" value="OAUTH2_CODE" />
            <t-option label="CAS 统一认证" value="CAS" />
            <t-option label="浏览器自动登录" value="PLAYWRIGHT" />
            <t-option label="静态 Token" value="TOKEN" />
          </t-select>
        </t-form-item>
        <t-form-item label="登录配置" name="loginConfig">
          <t-textarea v-model="form.loginConfig" :autosize="{ minRows: 3, maxRows: 3 }" placeholder="JSON格式登录配置" />
        </t-form-item>
        <div style="margin: -8px 0 16px 100px">
          <router-link to="/account/login-wizard" style="color: var(--primary); font-size: 13px">
            💡 不知道怎么配置？使用登录配置向导 →
          </router-link>
        </div>
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

const accounts = ref([])
const filter = ref({ systemName: '', status: null })
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增账号')
const isEdit = ref(false)
const form = ref({
  accountCode: '', accountName: '', systemName: '', username: '', password: '',
  authType: 'PASSWORD', authConfig: '', loginType: 'HTTP', loginConfig: '',
  tenantId: null, productCode: ''
})

const accountColumns = [
  { colKey: 'accountCode', title: '账号编码', width: 140 },
  { colKey: 'accountName', title: '显示名称', width: 150 },
  { colKey: 'systemName', title: '所属系统', width: 120 },
  { colKey: 'username', title: '用户名', width: 120 },
  { colKey: 'password', title: '密码', width: 120 },
  { colKey: 'authType', title: '认证类型', width: 100 },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'operate', title: '操作', width: 80, fixed: 'right', align: 'center', className: 'action-column' }
]

const loadAccounts = async () => {
  const params = { ...filter.value, pageNo: pageNo.value, pageSize: pageSize.value }
  const res = await api.get('/account/list', { params })
  accounts.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const onPageChange = (pageInfo) => {
  pageNo.value = pageInfo.current
  pageSize.value = pageInfo.pageSize
  loadAccounts()
}

const resetFilter = () => {
  filter.value = { systemName: '', status: null }
  pageNo.value = 1
  loadAccounts()
}

const showCreateDialog = () => {
  dialogTitle.value = '新增账号'
  isEdit.value = false
  form.value = { accountCode: '', accountName: '', systemName: '', username: '', password: '',
    authType: 'PASSWORD', authConfig: '', loginType: 'HTTP', loginConfig: '', tenantId: null, productCode: '' }
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
    MessagePlugin.warning('请填写必填字段')
    return
  }
  if (isEdit.value) {
    await api.put('/account/update?id=' + form.value.id, form.value)
    MessagePlugin.success('编辑成功')
  } else {
    if (!form.value.password) {
      MessagePlugin.warning('请输入密码')
      return
    }
    await api.post('/account/create', form.value)
    MessagePlugin.success('创建成功')
  }
  dialogVisible.value = false
  loadAccounts()
}

const deleteAccount = (id) => {
  const dialog = DialogPlugin.confirm({
    header: '提示',
    body: '确定删除该账号？',
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      dialog.hide()
      await api.delete('/account/delete', { params: { id } })
      MessagePlugin.success('删除成功')
      loadAccounts()
    }
  })
}

const onAccountCommand = (cmd, row) => {
  switch (cmd) {
    case 'edit': editAccount(row); break
    case 'delete': deleteAccount(row.id); break
  }
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

/* ── Table ── */
:deep(.el-table th) {
  padding: 7px 0 !important;
}

:deep(.el-table td) {
  padding: 5px 0 !important;
}

/* ── Fixed Column ── */
:deep(.el-table .el-table__fixed-right) {
  z-index: 10 !important;
  box-shadow: -4px 0 12px rgba(62, 207, 142, 0.1) !important;
}

:deep(.el-table .el-table__fixed-right::before) {
  display: none !important;
}

:deep(.el-table .el-table__fixed-right-patch) {
  background: var(--surface) !important;
}

:deep(.el-table .action-column) {
  background: var(--surface) !important;
  padding: 8px 0 !important;
}

:deep(.el-table td.action-column) {
  background: var(--surface) !important;
  padding: 8px 0 !important;
  height: auto !important;
}
</style>
