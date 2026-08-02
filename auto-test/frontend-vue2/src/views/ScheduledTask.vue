<template>
  <div>
    <t-card>
      <template #title><div class="card-header">
        <span>定时任务管理</span>
        <t-button theme="primary" @click="showCreateDialog">新增任务</t-button>
      </div></template>

      <t-table :data="tasks" :columns="taskColumns" row-key="id" :bordered="true" :stripe="true" style="margin-top:15px" />

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

    <t-dialog :visible="dialogVisible" @update:visible="val => dialogVisible = val" :header="dialogTitle" :width="600">
      <t-form :data="form" label-width="100px">
        <t-form-item label="任务名称">
          <t-input v-model="form.taskName" />
        </t-form-item>
        <t-form-item label="任务类型">
          <t-radio-group v-model="form.taskType">
            <t-radio value="SINGLE"><span>单链路</span></t-radio>
            <t-radio value="CATEGORY"><span>按分类</span></t-radio>
          </t-radio-group>
        </t-form-item>
        <t-form-item label="链路编码" v-if="form.taskType === 'SINGLE'">
          <t-input v-model="form.chainCode" placeholder="如 CHAIN_694346B3B0" />
        </t-form-item>
        <t-form-item label="选择分类" v-if="form.taskType === 'CATEGORY'">
          <t-cascader
            v-model="form.categoryId"
            :options="categoryTree"
            :props="{ value: 'id', label: 'categoryName', children: 'children', emitPath: false }"
            placeholder="选择要执行的分类"
            style="width:100%"
            clearable
          />
          <div class="form-hint">选择分类后，该分类下的所有链路将被执行</div>
        </t-form-item>
        <t-form-item label="Cron表达式">
          <t-input v-model="form.cronExpression" placeholder="如 0 0 2 * * ?" />
          <div class="form-hint">常用：0 0 2 * * ? (每天凌晨2点)</div>
        </t-form-item>
        <t-form-item label="间隔(分钟)">
          <t-input-number v-model="form.intervalMinutes" :min="1" placeholder="与Cron二选一" />
        </t-form-item>
      </t-form>
      <div slot="footer">
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </div>
    </t-dialog>
  </div>
</template>

<script>
import api from '../api/index.js'
import ActionMenu from '../components/ActionMenu.vue'

export default {
  name: 'ScheduledTask',
  components: { ActionMenu },
  data() {
    return {
      tasks: [],
      categoryTree: [],
      pageNo: 1,
      pageSize: 10,
      total: 0,
      taskColumns: [
        { colKey: 'taskName', title: '任务名称', width: 180 },
        { colKey: 'taskType', title: '任务类型', width: 120, cell: (h, ctx) => h('t-tag', { props: { theme: ctx.row.taskType === 'SINGLE' ? 'primary' : 'success' } }, ctx.row.taskType === 'SINGLE' ? '单链路' : '按分类') },
        { colKey: 'chainCode', title: '链路编码', width: 180, cell: (h, ctx) => ctx.row.chainCode || '-' },
        { colKey: 'schedule', title: '调度方式', width: 200, cell: (h, ctx) => ctx.row.cronExpression ? 'Cron: ' + ctx.row.cronExpression : (ctx.row.intervalMinutes ? '间隔: ' + ctx.row.intervalMinutes + '分钟' : '-') },
        { colKey: 'enabled', title: '状态', width: 80, cell: (h, ctx) => h('t-switch', {
          props: { value: ctx.row.enabled === 1 },
          on: { change: () => this.toggleTask(ctx.row) }
        }) },
        { colKey: 'lastRunTime', title: '上次执行', width: 180, cell: (h, ctx) => this.formatTime(ctx.row.lastRunTime) },
        { colKey: 'op', title: '操作', width: 80, fixed: 'right', align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: { items: [
            { label: '立即执行', command: 'trigger' },
            { label: '编辑', command: 'edit', divided: true },
            { label: '删除', command: 'delete', danger: true }
          ] },
          on: { command: (cmd) => this.onTaskCommand(cmd, ctx.row) }
        }) }
      ],
      dialogVisible: false,
      dialogTitle: '新增任务',
      isEdit: false,
      editId: null,
      form: {
        taskName: '',
        taskType: 'SINGLE',
        chainCode: '',
        categoryId: null,
        cronExpression: '',
        intervalMinutes: null
      }
    }
  },
  created() {
    this.loadTasks()
    this.loadCategoryTree()
  },
  methods: {
    async loadTasks() {
      const res = await api.get('/task/list', { params: { pageNo: this.pageNo, pageSize: this.pageSize } })
      this.tasks = (res.data && res.data.list) || []
      this.total = (res.data && res.data.total) || 0
    },
    handlePageChange(page) {
      this.pageNo = page
      this.loadTasks()
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.loadTasks()
    },
    formatTime(t) {
      return t ? new Date(t).toLocaleString() : '-'
    },
    showCreateDialog() {
      this.dialogTitle = '新增任务'
      this.isEdit = false
      this.editId = null
      this.form = { taskName: '', taskType: 'SINGLE', chainCode: '', categoryId: null, cronExpression: '', intervalMinutes: null }
      this.dialogVisible = true
    },
    editTask(row) {
      this.dialogTitle = '编辑任务'
      this.isEdit = true
      this.editId = row.id
      this.form = { ...row }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.taskName) {
        this.$message.warning('请输入任务名称')
        return
      }
      if (this.isEdit) {
        await api.put('/task/update?id=' + this.editId, this.form)
        this.$message.success('编辑成功')
      } else {
        await api.post('/task/create', this.form)
        this.$message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadTasks()
    },
    async toggleTask(row) {
      await api.put('/task/toggle?id=' + row.id)
      this.$message.success(row.enabled ? '已启用' : '已禁用')
    },
    async triggerTask(id) {
      await api.post('/task/trigger?id=' + id)
      this.$message.success('任务已触发')
      this.loadTasks()
    },
    deleteTask(id) {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定删除该任务？',
        onConfirm: async function() {
          await api.delete('/task/delete', { params: { id: id } })
          self.$message.success('删除成功')
          self.loadTasks()
        }
      })
    },
    onTaskCommand(cmd, row) {
      switch (cmd) {
        case 'trigger': this.triggerTask(row.id); break
        case 'edit': this.editTask(row); break
        case 'delete': this.deleteTask(row.id); break
      }
    },
    async loadCategoryTree() {
      try {
        const res = await api.get('/category/tree')
        this.categoryTree = res.data || []
      } catch (e) {
        console.error('Failed to load category tree', e)
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
  color: var(--sb-text);
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}
::v-deep(.t-table .action-column),
::v-deep(.t-table td.action-column) {
  background: var(--sb-surface, #ffffff) !important;
  padding: 8px 0 !important;
  height: auto !important;
}
::v-deep(.t-table .t-table__fixed-right-wrapper) {
  background: var(--sb-surface, #ffffff) !important;
}
::v-deep(.t-table .t-table__fixed-right::before) {
  display: none !important;
}
.form-hint {
  font-size: 12px;
  color: var(--sb-text-mute);
  margin-top: 4px;
}
</style>
