<template>
  <div>
    <t-card>
      <template #title><div class="card-header">
        <span>测试链路管理</span>
        <t-button theme="primary" @click="showCreateDialog">新增链路</t-button>
      </div></template>

      <div class="filter-bar">
        <t-input v-model="filter.chainName" placeholder="链路名称" clearable style="width:180px" />
        <t-select v-model="filter.executeMode" placeholder="执行模式" clearable style="width:130px;margin-left:10px">
          <t-option label="全串行" :value="1" />
          <t-option label="分组并行" :value="2" />
        </t-select>
        <t-select v-model="filter.priority" placeholder="优先级" clearable style="width:120px;margin-left:10px">
          <t-option label="P0 核心回归" :value="0" />
          <t-option label="P1 常规回归" :value="1" />
          <t-option label="P2 低频验证" :value="2" />
        </t-select>
        <t-button style="margin-left:10px" @click="categoryDialogVisible = true">
          <span v-if="selectedCategoryNames.length === 0">选择分类</span>
          <span v-else>已选分类 {{ selectedCategoryNames.length }} 项</span>
        </t-button>
        <t-button theme="primary" style="margin-left:10px" @click="handleSearch">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span>已选 {{ selectedRows.length }} 条</span>
        <t-button theme="success" size="small" @click="batchExecute">批量执行</t-button>
        <t-button theme="danger" size="small" @click="batchDelete">批量删除</t-button>
        <t-button size="small" @click="clearSelection">取消选择</t-button>
      </div>

      <t-table :data="chains" :columns="chainColumns" row-key="chainCode" :bordered="true" :stripe="true" style="margin-top:15px" :selected-row-keys="selectedRowKeys" @select-change="handleSelectionChange" ref="tableRef" />

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
        <t-form-item label="链路名称">
          <t-input v-model="form.chainName" />
        </t-form-item>
        <t-form-item label="执行模式">
          <t-select v-model="form.executeMode">
            <t-option label="全串行" :value="1" />
            <t-option label="分组并行" :value="2" />
          </t-select>
        </t-form-item>
        <t-form-item label="描述">
          <t-textarea v-model="form.description" :autosize="{ minRows: 3, maxRows: 5 }" />
        </t-form-item>
        <t-form-item label="分类">
          <div class="cat-form-item">
            <t-tag v-if="form.categoryId != null" size="small" class="cat-tag">
              {{ categoryTreeMap[form.categoryId] || '已选择' }}
            </t-tag>
            <span v-else class="muted-text">未选择分类</span>
            <t-button v-if="form.categoryId != null" variant="text" size="small" @click="form.categoryId = null">清除</t-button>
          </div>
          <div class="cat-tree-box">
            <CategoryTree mode="select" :key="dialogVisible" v-model="form.categoryId" />
          </div>
        </t-form-item>
        <t-form-item label="优先级">
          <t-select v-model="form.priority" clearable placeholder="选择优先级">
            <t-option label="P0 核心回归" :value="0" />
            <t-option label="P1 常规回归" :value="1" />
            <t-option label="P2 低频验证" :value="2" />
          </t-select>
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </template>
    </t-dialog>

    <!-- 分类选择弹窗 -->
    <t-dialog :visible="categoryDialogVisible" @update:visible="val => categoryDialogVisible = val" header="选择分类" :width="380" :close-on-overlay-click="false">
      <div class="cat-dialog">
        <div class="cat-dialog-hint">点击分类节点选择，可多选，再次点击取消</div>
        <div class="cat-dialog-tree">
          <CategoryTree mode="select" multiple v-model="filter.categoryIds" />
        </div>
        <div v-if="selectedCategoryNames.length" class="cat-selected">
          <t-tag v-for="name in selectedCategoryNames" :key="name" size="small" closable @close="removeCategoryByName(name)" class="cat-tag">{{ name }}</t-tag>
        </div>
      </div>
      <template #footer>
        <t-button variant="text" @click="clearCategoryFilter">清除</t-button>
        <t-button @click="categoryDialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="confirmCategory">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script>
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'

export default {
  name: 'ChainList',
  components: { CategoryTree, ActionMenu },
  data() {
    return {
      chains: [],
      filter: { chainName: '', executeMode: null, priority: null, categoryIds: [] },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      dialogVisible: false,
      categoryDialogVisible: false,
      dialogTitle: '新增链路',
      form: { chainName: '', executeMode: 1, description: '', categoryId: null, priority: 2, isEdit: false },
      selectedRows: [],
      selectedRowKeys: [],
      categoryTreeMap: {},
      categoryPathMap: {},
      categoryDescendantsMap: {},
      tableRef: null,
      chainColumns: [
        { colKey: 'row-select', type: 'multiple', width: 50 },
        { colKey: 'chainCode', title: '链路编码', width: 200 },
        { colKey: 'chainName', title: '链路名称', width: 200 },
        { colKey: 'executeMode', title: '执行模式', width: 120, cell: (h, ctx) => h('t-tag', { props: { theme: ctx.row.executeMode === 1 ? 'primary' : 'warning' } }, ctx.row.executeMode === 1 ? '全串行' : '分组并行') },
        { colKey: 'nodeCount', title: '节点数', width: 80 },
        { colKey: 'categoryId', title: '分类', minWidth: 180, cell: (h, ctx) => ctx.row.categoryId != null ? h('t-tag', { props: { size: 'small' } }, this.getCategoryPath(ctx.row.categoryId)) : h('span', { class: 'muted-text' }, '-') },
        { colKey: 'priority', title: '优先级', width: 100, cell: (h, ctx) => {
          if (ctx.row.priority === 0) return h('t-tag', { props: { theme: 'danger', size: 'small' } }, 'P0')
          if (ctx.row.priority === 1) return h('t-tag', { props: { theme: 'warning', size: 'small' } }, 'P1')
          return h('t-tag', { props: { theme: 'default', size: 'small' } }, 'P2')
        } },
        { colKey: 'createTime', title: '创建时间', width: 180, cell: (h, ctx) => this.formatTime(ctx.row.createTime) },
        { colKey: 'op', title: '操作', width: 220, fixed: 'right', align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: {
            items: [
              { label: '编排', command: 'edit-flow' },
              { label: '执行', command: 'execute' },
              { label: '复制', command: 'copy' },
              { label: '编辑', command: 'edit', divided: true },
              { label: '删除', command: 'delete', divided: true, danger: true }
            ]
          },
          on: { command: (cmd) => this.onChainCommand(cmd, ctx.row) }
        }) }
      ]
    }
  },
  computed: {
    selectedCategoryNames() {
      const self = this
      return this.filter.categoryIds.map(function(id) {
        return self.categoryTreeMap[id] != null ? self.categoryTreeMap[id] : id
      })
    }
  },
  mounted() {
    this.loadCategoryTreeMap()
    this.loadChains()
  },
  methods: {
    async loadCategoryTreeMap() {
      try {
        const res = await api.get('/category/tree')
        const flat = {}
        const pathMap = {}
        const descendants = {}
        const self = this
        const walk = function(nodes, parentPath) {
          (nodes || []).forEach(function(n) {
            flat[n.id] = n.categoryName
            const full = parentPath ? parentPath + ' / ' + n.categoryName : n.categoryName
            pathMap[n.id] = full
            if (n.children) walk(n.children, full)
          })
        }
        const collectDescendants = function(nodes, acc) {
          ;(nodes || []).forEach(function(n) {
            acc.push(n.id)
            if (n.children) collectDescendants(n.children, acc)
          })
        }
        ;(res.data || []).forEach(function(n) {
          const acc = []
          collectDescendants([n], acc)
          descendants[n.id] = acc
        })
        walk(res.data || [], '')
        this.categoryTreeMap = flat
        this.categoryPathMap = pathMap
        this.categoryDescendantsMap = descendants
      } catch (e) { /* ignore */ }
    },
    expandCategoryIds(ids) {
      const self = this
      const result = []
      ;(ids || []).forEach(function(id) {
        const sub = self.categoryDescendantsMap && self.categoryDescendantsMap[id]
        if (sub && sub.length) {
          sub.forEach(function(x) { if (result.indexOf(x) === -1) result.push(x) })
        } else if (result.indexOf(id) === -1) {
          result.push(id)
        }
      })
      return result
    },
    getCategoryPath(id) {
      if (id == null) return '-'
      return this.categoryPathMap[id] || this.categoryTreeMap[id] || '-'
    },
    removeCategoryByName(name) {
      const self = this
      const id = Object.keys(this.categoryTreeMap).find(function(k) { return self.categoryTreeMap[k] === name })
      if (id != null) {
        this.filter.categoryIds = this.filter.categoryIds.filter(function(x) { return String(x) !== String(id) })
      }
    },
    clearCategoryFilter() {
      this.filter.categoryIds = []
    },
    confirmCategory() {
      this.categoryDialogVisible = false
      this.handleSearch()
    },
    async loadChains() {
      const params = {
        chainName: this.filter.chainName,
        executeMode: this.filter.executeMode,
        priority: this.filter.priority,
        pageNo: this.pageNo,
        pageSize: this.pageSize
      }
      if (this.filter.categoryIds.length) {
        params.categoryId = this.expandCategoryIds(this.filter.categoryIds).join(',')
      }
      const res = await api.get('/chain/list', { params: params })
      this.chains = res.data && res.data.list ? res.data.list : []
      this.total = res.data && res.data.total ? res.data.total : 0
    },
    resetFilter() {
      this.filter = { chainName: '', executeMode: null, priority: null, categoryIds: [] }
      this.pageNo = 1
      this.loadChains()
    },
    handleSearch() {
      this.pageNo = 1
      this.loadChains()
    },
    handlePageChange(page) {
      this.pageNo = page
      this.loadChains()
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.loadChains()
    },
    formatTime(t) {
      if (!t) return '-'
      return new Date(t).toLocaleString()
    },
    showCreateDialog() {
      this.dialogTitle = '新增链路'
      this.form = { chainName: '', executeMode: 1, description: '', categoryId: null, priority: 2, isEdit: false }
      this.dialogVisible = true
    },
    editChain(row) {
      this.dialogTitle = '编辑链路'
      const newForm = Object.assign({}, row)
      newForm.isEdit = true
      this.form = newForm
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.chainName) {
        this.$message.warning('请输入链路名称')
        return
      }
      try {
        if (this.form.isEdit) {
          await api.post('/chain/edit', this.form)
          this.$message.success('编辑成功')
        } else {
          await api.post('/chain/create', this.form)
          this.$message.success('创建成功')
        }
      } catch (e) {
        this.$message.error('操作失败: ' + (e.response && e.response.data && e.response.data.message ? e.response.data.message : e.message))
        return
      }
      this.dialogVisible = false
      this.loadChains()
    },
    async copyChain(chainCode) {
      await api.post('/chain/copy', { chainCode: chainCode })
      this.$message.success('复制成功')
      this.loadChains()
    },
    deleteChain(chainCode) {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定删除该链路？关联节点将同步删除。',
        onConfirm: async function() {
          await api.post('/chain/delete', null, { params: { chainCode: chainCode } })
          self.$message.success('删除成功')
          self.loadChains()
        }
      })
    },
    async executeChain(chainCode) {
      const res = await api.post('/execute/run', { chainCode: chainCode })
      this.$message.success('执行已启动，执行ID: ' + res.data.executionId)
    },
    onChainCommand(cmd, row) {
      switch (cmd) {
        case 'edit-flow': this.$router.push('/chain/edit/' + row.chainCode); break
        case 'execute': this.executeChain(row.chainCode); break
        case 'copy': this.copyChain(row.chainCode); break
        case 'edit': this.editChain(row); break
        case 'delete': this.deleteChain(row.chainCode); break
      }
    },
    handleSelectionChange(ctx) {
      if (ctx && ctx.selectedRowKeys) {
        this.selectedRowKeys = ctx.selectedRowKeys
        this.selectedRows = ctx.selectedRowData || []
      }
    },
    clearSelection() {
      if (this.$refs.tableRef) this.$refs.tableRef.clearSelected()
      this.selectedRowKeys = []
      this.selectedRows = []
    },
    batchDelete() {
      if (!this.selectedRows.length) return
      const self = this
      this.$dialog.confirm({
        header: '批量删除',
        body: '确定删除选中的 ' + this.selectedRows.length + ' 条链路？关联节点将同步删除。',
        onConfirm: async function() {
          const chainCodes = self.selectedRows.map(function(r) { return r.chainCode })
          const res = await api.post('/chain/batchDelete', { chainCodes: chainCodes })
          self.$message.success('删除完成: 成功' + res.data.successCount + '条，失败' + res.data.failCount + '条')
          self.clearSelection()
          self.loadChains()
        }
      })
    },
    async batchExecute() {
      if (!this.selectedRows.length) return
      const chainCodes = this.selectedRows.map(function(r) { return r.chainCode })
      const res = await api.post('/execute/batchRun', { chainCodes: chainCodes })
      const results = res.data || []
      const submitted = results.filter(function(r) { return r.status === 'started' }).length
      const rejected = results.filter(function(r) { return r.status === 'failed' }).length
      if (rejected > 0) {
        this.$message.warning('已提交 ' + submitted + ' 条执行任务，' + rejected + ' 条启动失败（链路不存在或无节点配置）')
      } else {
        this.$message.success('已提交 ' + submitted + ' 条执行任务，最终结果请到「执行记录」中查看')
      }
      this.clearSelection()
    }
  }
}
</script>

<style scoped>
/* ── Card Wrapper ── */
::v-deep .t-card {
  border-radius: 12px;
  overflow: visible;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.10);
}

::v-deep .t-card__header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.10);
  background: rgba(62, 207, 142, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.card-header > span:first-child {
  font-size: 18px;
  font-weight: 700;
  color: var(--sb-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Primary Button ── */
::v-deep .t-button--theme-primary {
  background: linear-gradient(135deg, #3ecf8e, #4ade80);
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #0a0a0a;
  box-shadow: 0 2px 8px rgba(62, 207, 142, 0.18);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

::v-deep .t-button--theme-primary:hover {
  box-shadow: 0 4px 16px rgba(62, 207, 142, 0.3);
  transform: translateY(-1px);
  filter: brightness(1.05);
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  flex-wrap: wrap;
}

.filter-bar ::v-deep .t-input,
.filter-bar ::v-deep .t-select {
  border-radius: 6px;
  background: var(--sb-surface);
  border: 1px solid rgba(0, 0, 0, 0.16);
  box-shadow: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.filter-bar ::v-deep .t-input:hover,
.filter-bar ::v-deep .t-select:hover {
  border-color: rgba(62, 207, 142, 0.55);
}

.filter-bar ::v-deep .t-input.is-focus {
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.16);
  border-color: #3ecf8e;
}

.filter-bar ::v-deep .t-button {
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-bar ::v-deep .t-button:hover {
  transform: translateY(-1px);
}

/* ── Category Dialog ── */
.cat-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cat-dialog-hint {
  font-size: 12px;
  color: var(--sb-text-mute, #8b8b8b);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.1));
}
.cat-dialog-tree {
  max-height: 300px;
  overflow-y: auto;
  padding: 4px 2px;
}
.cat-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
.cat-tag {
  background: rgba(62, 207, 142, 0.12);
  border-color: rgba(62, 207, 142, 0.3);
  color: #047857;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-text {
  color: #9ca3af;
}

.cat-form-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cat-tree-box {
  max-height: 220px;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--sb-surface);
}

/* ── Batch Bar ── */
.batch-bar {
  margin-top: 16px;
  padding: 14px 20px;
  background: rgba(62, 207, 142, 0.06);
  border: 1px solid rgba(62, 207, 142, 0.20);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.batch-bar span {
  color: #24b47e;
  font-weight: 600;
  font-size: 14px;
}

/* ── Table ── */
::v-deep .t-table {
  border-radius: 0 0 12px 12px;
  overflow: visible;
  font-size: 13px;
}

::v-deep .t-table th.t-table__cell {
  background: rgba(62, 207, 142, 0.06) !important;
  color: #3f3f46 !important;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.10) !important;
  padding: 7px 0 !important;
}

::v-deep .t-table td.t-table__cell {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 5px 0 !important;
  color: var(--sb-text);
}

::v-deep .t-table--striped .t-table__body tr.t-table__row--striped td.t-table__cell {
  background: rgba(62, 207, 142, 0.04);
}

/* ── Fixed Column - Action Column ── */
::v-deep .t-table .t-table__fixed-right {
  z-index: 10 !important;
  box-shadow: -4px 0 12px rgba(62, 207, 142, 0.12) !important;
  background: var(--sb-surface);
}

::v-deep .t-table .t-table__fixed-right::before {
  display: none !important;
}

::v-deep .t-table .t-table__fixed-right-patch {
  background: var(--sb-surface) !important;
}

::v-deep .t-table .action-column,
::v-deep .t-table td.action-column {
  background: var(--sb-surface) !important;
  padding: 8px 0 !important;
  height: auto !important;
}

::v-deep .t-table .t-table__fixed-right-wrapper .t-table__header th:last-child,
::v-deep .t-table .t-table__fixed-right-wrapper .t-table__header th.action-column {
  background: rgba(62, 207, 142, 0.06) !important;
  color: #3f3f46 !important;
}

::v-deep .t-table .t-table__fixed-right-wrapper {
  background: var(--sb-surface) !important;
}

/* ── Tags ── */
::v-deep .t-tag {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Dialog ── */
::v-deep .t-dialog {
  border-radius: 12px;
  overflow: hidden;
  background: var(--sb-surface);
}

::v-deep .t-dialog__header {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.10);
}

::v-deep .t-dialog__body {
  padding: 24px;
  color: var(--sb-text);
}

::v-deep .t-dialog__footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.10);
}

::v-deep .t-form__label {
  font-weight: 500;
  color: #3f3f46;
}

::v-deep .t-input,
::v-deep .t-textarea {
  border-radius: 6px;
  background: var(--sb-surface);
  border: 1px solid rgba(0, 0, 0, 0.16);
  box-shadow: none;
  color: var(--sb-text);
}

::v-deep .t-input:hover,
::v-deep .t-textarea:hover {
  border-color: rgba(62, 207, 142, 0.55);
}

::v-deep .t-input.is-focus,
::v-deep .t-textarea:focus {
  box-shadow: 0 0 0 2px rgba(62, 207, 142, 0.16);
  border-color: #3ecf8e;
}

/* ── Dropdown in Action Column ── */
.action-trigger {
  cursor: pointer;
  color: #3ecf8e;
  font-size: 16px;
}
.action-trigger:hover {
  color: #4ade80;
}

/* 危险操作颜色 */
.danger-item {
  color: #f56c6c !important;
}

/* ── Pagination ── */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}

::v-deep .t-pagination .t-pagination__number.t-is-current {
  background: linear-gradient(135deg, #3ecf8e, #4ade80);
  color: #0a0a0a;
  border-radius: 8px;
}

::v-deep .t-pagination .t-pagination__number {
  border-radius: 8px;
  min-width: 32px;
}
</style>
