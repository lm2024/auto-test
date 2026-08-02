<template>
  <div>
    <t-card>
      <template #title><div class="card-header">
        <span>测试账号管理</span>
        <t-button theme="primary" @click="showCreateDialog">新增账号</t-button>
      </div></template>

      <div class="filter-bar">
        <t-input v-model="filter.systemName" placeholder="所属系统" clearable style="width:200px" />
        <t-select v-model="filter.status" placeholder="状态" clearable style="width:150px;margin-left:10px">
          <t-option label="可用" :value="1" />
          <t-option label="锁定" :value="2" />
          <t-option label="禁用" :value="0" />
        </t-select>
        <t-button theme="primary" style="margin-left:10px" @click="handleSearch">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <t-table :data="accounts" :columns="accountColumns" row-key="accountCode" :bordered="true" :stripe="true" style="margin-top:15px" />

      <div class="pagination-bar">
        <t-pagination
          :total="total"
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50, 100]"
          show-jumper
          show-page-size
          @current-change="handlePageChange"
          @page-size-change="handleSizeChange"
        />
      </div>
    </t-card>

    <t-dialog :visible="dialogVisible" @update:visible="val => dialogVisible = val" :header="dialogTitle" :width="500">
      <t-form :data="form" label-width="100px">
        <t-form-item label="账号编码">
          <t-input v-model="form.accountCode" :disabled="isEdit" />
        </t-form-item>
        <t-form-item label="显示名称">
          <t-input v-model="form.accountName" />
        </t-form-item>
        <t-form-item label="所属系统">
          <t-input v-model="form.systemName" />
        </t-form-item>
        <t-form-item label="用户名">
          <t-input v-model="form.username" />
        </t-form-item>
        <t-form-item label="密码">
          <t-input v-model="form.password" type="password" :placeholder="isEdit ? '留空不修改' : ''" />
        </t-form-item>
        <t-form-item label="认证类型">
          <t-select v-model="form.authType">
            <t-option label="PASSWORD" value="PASSWORD" />
            <t-option label="SSO" value="SSO" />
            <t-option label="TOKEN" value="TOKEN" />
          </t-select>
        </t-form-item>
        <t-form-item label="认证配置">
          <t-textarea v-model="form.authConfig" :autosize="{ minRows: 3, maxRows: 5 }" placeholder="JSON格式，如SSO登录地址" />
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script>
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'

export default {
  name: 'AccountList',
  components: {
    ActionMenu
  },
  data() {
    return {
      accounts: [],
      filter: { systemName: '', status: null },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      accountColumns: [
        { colKey: 'accountCode', title: '账号编码', width: 140 },
        { colKey: 'accountName', title: '显示名称', width: 150 },
        { colKey: 'systemName', title: '所属系统', width: 120 },
        { colKey: 'username', title: '用户名', width: 120 },
        { colKey: 'password', title: '密码', width: 120, cell: (h) => h('span', { style: 'color:#999' }, '••••••') },
        { colKey: 'authType', title: '认证类型', width: 100 },
        { colKey: 'status', title: '状态', width: 90, cell: (h, ctx) => {
          const st = ctx.row.status
          return h('t-tag', { props: { theme: st === 1 ? 'success' : st === 2 ? 'warning' : 'default' } }, st === 1 ? '可用' : st === 2 ? '锁定' : '禁用')
        } },
        { colKey: 'op', title: '操作', width: 80, fixed: 'right', align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: { items: [{ label: '编辑', command: 'edit' }, { label: '删除', command: 'delete', divided: true, danger: true }] },
          on: { command: (cmd) => this.onAccountCommand(cmd, ctx.row) }
        }) }
      ],
      dialogVisible: false,
      dialogTitle: '新增账号',
      isEdit: false,
      form: {
        accountCode: '',
        accountName: '',
        systemName: '',
        username: '',
        password: '',
        authType: 'PASSWORD',
        authConfig: ''
      }
    }
  },
  created() {
    this.loadAccounts()
  },
  methods: {
    async loadAccounts() {
      const params = Object.assign({}, this.filter, { pageNo: this.pageNo, pageSize: this.pageSize })
      const res = await api.get('/account/list', { params })
      this.accounts = res.data && res.data.list ? res.data.list : []
      this.total = res.data && res.data.total ? res.data.total : 0
    },
    resetFilter() {
      this.filter = { systemName: '', status: null }
      this.pageNo = 1
      this.loadAccounts()
    },
    handlePageChange(page) {
      this.pageNo = page
      this.loadAccounts()
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.loadAccounts()
    },
    handleSearch() {
      this.pageNo = 1
      this.loadAccounts()
    },
    showCreateDialog() {
      this.dialogTitle = '新增账号'
      this.isEdit = false
      this.form = {
        accountCode: '',
        accountName: '',
        systemName: '',
        username: '',
        password: '',
        authType: 'PASSWORD',
        authConfig: ''
      }
      this.dialogVisible = true
    },
    editAccount(row) {
      this.dialogTitle = '编辑账号'
      this.isEdit = true
      this.form = Object.assign({}, row, { password: '' })
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.accountCode || !this.form.accountName || !this.form.username) {
        this.$message.warning('请填写必填字段')
        return
      }
      if (this.isEdit) {
        await api.put('/account/update?id=' + this.form.id, this.form)
        this.$message.success('编辑成功')
      } else {
        if (!this.form.password) {
          this.$message.warning('请输入密码')
          return
        }
        await api.post('/account/create', this.form)
        this.$message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadAccounts()
    },
    deleteAccount(id) {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定删除该账号？',
        onConfirm: async function() {
          await api.delete('/account/delete', { params: { id: id } })
          self.$message.success('删除成功')
          self.loadAccounts()
        }
      })
    },
    onAccountCommand(cmd, row) {
      if (cmd === 'edit') {
        this.editAccount(row)
      } else if (cmd === 'delete') {
        this.deleteAccount(row.id)
      }
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

/* Table */
::v-deep(.t-table th) {
  padding: 7px 0 !important;
}

::v-deep(.t-table td) {
  padding: 5px 0 !important;
}

/* Fixed Column */
::v-deep(.t-table .t-table__fixed-right) {
  box-shadow: -4px 0 12px rgba(62, 207, 142, 0.1) !important;
}

::v-deep(.t-table .t-table__fixed-right::before) {
  display: none !important;
}

::v-deep(.t-table .t-table__fixed-right-patch) {
  background: var(--sb-surface) !important;
}

::v-deep(.t-table .action-column) {
  background: var(--sb-surface) !important;
  padding: 8px 0 !important;
}

::v-deep(.t-table td.action-column) {
  background: var(--sb-surface) !important;
  padding: 8px 0 !important;
  height: auto !important;
}
</style>
