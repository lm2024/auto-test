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
          <template #default>
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
        <el-table-column label="操作" width="200" fixed="right" align="center" class-name="action-column">
          <template #default="{ row, $index }">
            <div class="action-btns" :style="{ background: $index % 2 === 1 ? '#fafafe' : '#ffffff' }">
              <el-button size="small" @click="editAccount(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteAccount(row.id)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          :current-page="pageNo"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="onPageSizeChange"
          @current-change="onPageChange"
        />
      </div>
    </el-card>

    <el-dialog :visible.sync="dialogVisible" :title="dialogTitle" width="500px">
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

<script>
import { Message, MessageBox } from 'element-ui'
import api from '../api'

export default {
  name: 'AccountList',
  data() {
    return {
      accounts: [],
      filter: { systemName: '', status: null },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      dialogVisible: false,
      dialogTitle: '新增账号',
      isEdit: false,
      form: {
        accountCode: '', accountName: '', systemName: '', username: '', password: '', authType: 'PASSWORD', authConfig: ''
      }
    }
  },
  mounted() {
    this.loadAccounts()
  },
  methods: {
    async loadAccounts() {
      const params = { ...this.filter, pageNo: this.pageNo, pageSize: this.pageSize }
      const res = await api.get('/account/list', { params })
      this.accounts = (res.data && res.data.list) || []
      this.total = (res.data && res.data.total) || 0
    },
    onPageSizeChange(val) { this.pageSize = val; this.loadAccounts() },
    onPageChange(val) { this.pageNo = val; this.loadAccounts() },
    resetFilter() {
      this.filter = { systemName: '', status: null }
      this.pageNo = 1
      this.loadAccounts()
    },
    showCreateDialog() {
      this.dialogTitle = '新增账号'
      this.isEdit = false
      this.form = { accountCode: '', accountName: '', systemName: '', username: '', password: '', authType: 'PASSWORD', authConfig: '' }
      this.dialogVisible = true
    },
    editAccount(row) {
      this.dialogTitle = '编辑账号'
      this.isEdit = true
      this.form = { ...row, password: '' }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.accountCode || !this.form.accountName || !this.form.username) {
        Message.warning('请填写必填字段')
        return
      }
      if (this.isEdit) {
        await api.put('/account/update?id=' + this.form.id, this.form)
        Message.success('编辑成功')
      } else {
        if (!this.form.password) {
          Message.warning('请输入密码')
          return
        }
        await api.post('/account/create', this.form)
        Message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadAccounts()
    },
    async deleteAccount(id) {
      await MessageBox.confirm('确定删除该账号？', '提示', { type: 'warning' })
      await api.delete('/account/delete', { params: { id } })
      Message.success('删除成功')
      this.loadAccounts()
    }
  }
}
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
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}

/* ── Table ── */
::v-deep .el-table th {
  padding: 7px 0 !important;
}

::v-deep .el-table td {
  padding: 5px 0 !important;
}

/* ── Fixed Column ── */
::v-deep .el-table .el-table__fixed-right {
  z-index: 10 !important;
  box-shadow: -4px 0 12px rgba(99, 102, 241, 0.1) !important;
}

::v-deep .el-table .el-table__fixed-right::before {
  display: none !important;
}

::v-deep .el-table .el-table__fixed-body-wrapper {
  background: #fff !important;
}

::v-deep .el-table .action-column {
  background: #fff !important;
  padding: 8px 0 !important;
}

::v-deep .el-table td.action-column {
  background: #fff !important;
  padding: 8px 0 !important;
  height: auto !important;
}

/* ── Action Buttons ── */
.action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-wrap: nowrap;
  background: #ffffff !important;
  background-color: #ffffff !important;
  width: 100%;
}

.action-btns ::v-deep .el-button {
  margin: 0;
  padding: 7px 11px;
  font-size: 12px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btns ::v-deep .el-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btns ::v-deep .el-button:active {
  transform: translateY(0) scale(0.98);
}
</style>
