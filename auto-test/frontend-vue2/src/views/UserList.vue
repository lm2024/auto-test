<template>
  <div>
    <t-card>
      <template #title><div class="card-header">
        <span>用户管理</span>
        <t-button theme="primary" @click="showCreateDialog">新增用户</t-button>
      </div></template>

      <div class="filter-bar">
        <t-input v-model="filter.keyword" placeholder="搜索用户名/姓名" clearable style="width:200px" />
        <t-button theme="primary" style="margin-left:10px" @click="handleSearch">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <t-table :data="users" :columns="userColumns" row-key="id" :bordered="true" :stripe="true" style="margin-top:15px" />

      <div class="pagination-bar">
        <t-pagination
          :total="total"
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50]"
          show-jumper
          show-page-size
          @current-change="handlePageChange"
          @page-size-change="handleSizeChange"
        />
      </div>
    </t-card>

    <t-dialog :visible="dialogVisible" @update:visible="val => dialogVisible = val" :header="dialogTitle" :width="500">
      <t-form :data="form" label-width="100px">
        <t-form-item label="用户名">
          <t-input v-model="form.username" :disabled="isEdit" />
        </t-form-item>
        <t-form-item label="密码" v-if="!isEdit">
          <t-input v-model="form.password" type="password" />
        </t-form-item>
        <t-form-item label="密码" v-else>
          <t-input v-model="form.password" type="password" placeholder="留空不修改" />
        </t-form-item>
        <t-form-item label="显示名称">
          <t-input v-model="form.displayName" />
        </t-form-item>
        <t-form-item label="角色">
          <t-select v-model="form.role">
            <t-option label="管理员" value="ADMIN" />
            <t-option label="普通用户" value="USER" />
          </t-select>
        </t-form-item>
        <t-form-item label="状态" v-if="isEdit">
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

<script>
import api from '../api'
import ActionMenu from '../components/ActionMenu.vue'

export default {
  name: 'UserList',
  components: {
    ActionMenu
  },
  data() {
    return {
      users: [],
      filter: { keyword: '' },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      userColumns: [
        { colKey: 'username', title: '用户名', width: 150 },
        { colKey: 'displayName', title: '显示名称', width: 150 },
        { colKey: 'role', title: '角色', width: 100, cell: (h, ctx) => h('t-tag', { props: { theme: ctx.row.role === 'ADMIN' ? 'danger' : 'default' } }, ctx.row.role === 'ADMIN' ? '管理员' : '普通用户') },
        { colKey: 'status', title: '状态', width: 80, cell: (h, ctx) => h('t-tag', { props: { theme: ctx.row.status === 1 ? 'success' : 'default' } }, ctx.row.status === 1 ? '启用' : '禁用') },
        { colKey: 'lastLoginTime', title: '最后登录', width: 180, cell: (h, ctx) => this.formatTime(ctx.row.lastLoginTime) },
        { colKey: 'createTime', title: '创建时间', width: 180, cell: (h, ctx) => this.formatTime(ctx.row.createTime) },
        { colKey: 'op', title: '操作', width: 80, fixed: 'right', align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: { items: [{ label: '编辑', command: 'edit' }, { label: '删除', command: 'delete', divided: true, danger: true }] },
          on: { command: (cmd) => this.onUserCommand(cmd, ctx.row) }
        }) }
      ],
      dialogVisible: false,
      dialogTitle: '新增用户',
      isEdit: false,
      editId: null,
      form: {
        username: '',
        password: '',
        displayName: '',
        role: 'USER',
        status: 1
      }
    }
  },
  created() {
    this.loadUsers()
  },
  methods: {
    async loadUsers() {
      const params = Object.assign({}, this.filter, { pageNo: this.pageNo, pageSize: this.pageSize })
      if (!params.keyword) {
        delete params.keyword
      }
      const res = await api.get('/user/list', { params })
      this.users = res.data && res.data.list ? res.data.list : []
      this.total = res.data && res.data.total ? res.data.total : 0
    },
    resetFilter() {
      this.filter = { keyword: '' }
      this.pageNo = 1
      this.loadUsers()
    },
    handlePageChange(page) {
      this.pageNo = page
      this.loadUsers()
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.loadUsers()
    },
    handleSearch() {
      this.pageNo = 1
      this.loadUsers()
    },
    formatTime(t) {
      return t ? new Date(t).toLocaleString() : '-'
    },
    showCreateDialog() {
      this.dialogTitle = '新增用户'
      this.isEdit = false
      this.editId = null
      this.form = {
        username: '',
        password: '',
        displayName: '',
        role: 'USER',
        status: 1
      }
      this.dialogVisible = true
    },
    editUser(row) {
      this.dialogTitle = '编辑用户'
      this.isEdit = true
      this.editId = row.id
      this.form = {
        username: row.username,
        password: '',
        displayName: row.displayName,
        role: row.role,
        status: row.status
      }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.username) {
        this.$message.warning('请输入用户名')
        return
      }
      if (!this.isEdit && !this.form.password) {
        this.$message.warning('请输入密码')
        return
      }
      if (this.isEdit) {
        await api.put('/user/update?id=' + this.editId, this.form)
        this.$message.success('编辑成功')
      } else {
        await api.post('/user/create', this.form)
        this.$message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadUsers()
    },
    deleteUser(id) {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定删除该用户？',
        onConfirm: async function() {
          await api.delete('/user/delete', { params: { id: id } })
          self.$message.success('删除成功')
          self.loadUsers()
        }
      })
    },
    onUserCommand(cmd, row) {
      if (cmd === 'edit') {
        this.editUser(row)
      } else if (cmd === 'delete') {
        this.deleteUser(row.id)
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
::v-deep(.t-table .action-column),
::v-deep(.t-table td.action-column) {
  background: var(--sb-surface) !important;
  padding: 8px 0 !important;
  height: auto !important;
}
::v-deep(.t-table .t-table__fixed-right-wrapper) {
  background: var(--sb-surface) !important;
}
::v-deep(.t-table .t-table__fixed-right::before) {
  display: none !important;
}
</style>
