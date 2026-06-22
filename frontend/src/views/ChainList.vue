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
        <el-input v-model="filter.chainName" placeholder="链路名称" clearable style="width:180px" />
        <el-select v-model="filter.executeMode" placeholder="执行模式" clearable style="width:130px;margin-left:10px">
          <el-option label="全串行" :value="1" />
          <el-option label="分组并行" :value="2" />
        </el-select>
        <el-select v-model="filter.systemCategory" placeholder="系统分类" clearable style="width:130px;margin-left:10px">
          <el-option v-for="item in systemCategories" :key="item.categoryCode" :label="item.categoryName" :value="item.categoryCode" />
        </el-select>
        <el-select v-model="filter.funcCategory" placeholder="功能分类" clearable style="width:130px;margin-left:10px">
          <el-option v-for="item in funcCategories" :key="item.categoryCode" :label="item.categoryName" :value="item.categoryCode" />
        </el-select>
        <el-select v-model="filter.priority" placeholder="优先级" clearable style="width:120px;margin-left:10px">
          <el-option label="P0 核心回归" :value="0" />
          <el-option label="P1 常规回归" :value="1" />
          <el-option label="P2 低频验证" :value="2" />
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
        <el-table-column label="系统分类" width="120">
          <template #default="{ row }">
            {{ getCategoryName('system', row.systemCategory) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="功能分类" width="120">
          <template #default="{ row }">
            {{ getCategoryName('func', row.funcCategory) || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.priority === 0" type="danger" size="small">P0</el-tag>
            <el-tag v-else-if="row.priority === 1" type="warning" size="small">P1</el-tag>
            <el-tag v-else type="info" size="small">P2</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right" align="center" class-name="action-column">
          <template #default="{ row, $index }">
            <div class="action-btns" :style="{ background: $index % 2 === 1 ? '#fafafe' : '#ffffff' }">
              <el-button size="small" @click="$router.push('/chain/edit/' + row.chainCode)">编排</el-button>
              <el-button size="small" type="success" @click="executeChain(row.chainCode)">执行</el-button>
              <el-button size="small" @click="copyChain(row.chainCode)">复制</el-button>
              <el-button size="small" @click="editChain(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteChain(row.chainCode)">删除</el-button>
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
        <el-form-item label="系统分类">
          <el-select v-model="form.systemCategory" clearable placeholder="选择系统分类">
            <el-option v-for="item in systemCategories" :key="item.categoryCode" :label="item.categoryName" :value="item.categoryCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="功能分类">
          <el-select v-model="form.funcCategory" clearable placeholder="选择功能分类">
            <el-option v-for="item in funcCategories" :key="item.categoryCode" :label="item.categoryName" :value="item.categoryCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority" clearable placeholder="选择优先级">
            <el-option label="P0 核心回归" :value="0" />
            <el-option label="P1 常规回归" :value="1" />
            <el-option label="P2 低频验证" :value="2" />
          </el-select>
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
  name: 'ChainList',
  data() {
    return {
      chains: [],
      filter: { chainName: '', executeMode: null, systemCategory: '', funcCategory: '', priority: null },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      dialogVisible: false,
      dialogTitle: '新增链路',
      form: { chainName: '', executeMode: 1, description: '', systemCategory: '', funcCategory: '', priority: 2, isEdit: false },
      selectedRows: [],
      systemCategories: [],
      funcCategories: []
    }
  },
  mounted() {
    this.loadCategories()
    this.loadChains()
  },
  methods: {
    async loadCategories() {
      try {
        const sysRes = await api.get('/dict/category/list', { params: { type: 'system' } })
        this.systemCategories = sysRes.data || []
        const funcRes = await api.get('/dict/category/list', { params: { type: 'func' } })
        this.funcCategories = funcRes.data || []
      } catch(e) { /* ignore */ }
    },
    getCategoryName(type, code) {
      if (!code) return ''
      const list = type === 'system' ? this.systemCategories : this.funcCategories
      const item = list.find(c => c.categoryCode === code)
      return item ? item.categoryName : code
    },
    async loadChains() {
      const params = { ...this.filter, pageNo: this.pageNo, pageSize: this.pageSize }
      if (!params.systemCategory) delete params.systemCategory
      if (!params.funcCategory) delete params.funcCategory
      if (params.priority === null || params.priority === undefined || params.priority === '') delete params.priority
      const res = await api.get('/chain/list', { params })
      this.chains = (res.data && res.data.list) || []
      this.total = (res.data && res.data.total) || 0
    },
    onPageSizeChange(val) { this.pageSize = val; this.loadChains() },
    onPageChange(val) { this.pageNo = val; this.loadChains() },
    resetFilter() {
      this.filter = { chainName: '', executeMode: null, systemCategory: '', funcCategory: '', priority: null }
      this.pageNo = 1
      this.loadChains()
    },
    formatTime(t) {
      if (!t) return '-'
      return new Date(t).toLocaleString()
    },
    showCreateDialog() {
      this.dialogTitle = '新增链路'
      this.form = { chainName: '', executeMode: 1, description: '', systemCategory: '', funcCategory: '', priority: 2, isEdit: false }
      this.dialogVisible = true
    },
    editChain(row) {
      this.dialogTitle = '编辑链路'
      this.form = { ...row, isEdit: true }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.chainName) {
        Message.warning('请输入链路名称')
        return
      }
      if (this.form.isEdit) {
        await api.post('/chain/edit', this.form)
        Message.success('编辑成功')
      } else {
        await api.post('/chain/create', this.form)
        Message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadChains()
    },
    async copyChain(chainCode) {
      await api.post('/chain/copy', { chainCode })
      Message.success('复制成功')
      this.loadChains()
    },
    async deleteChain(chainCode) {
      await MessageBox.confirm('确定删除该链路？关联节点将同步删除。', '提示', { type: 'warning' })
      await api.post('/chain/delete', null, { params: { chainCode } })
      Message.success('删除成功')
      this.loadChains()
    },
    async executeChain(chainCode) {
      const res = await api.post('/execute/run', { chainCode })
      Message.success('执行已启动，执行ID: ' + res.data.executionId)
    },
    handleSelectionChange(rows) {
      this.selectedRows = rows
    },
    clearSelection() {
      if (this.$refs.tableRef) { this.$refs.tableRef.clearSelection() }
    },
    async batchDelete() {
      if (!this.selectedRows.length) return
      await MessageBox.confirm(`确定删除选中的 ${this.selectedRows.length} 条链路？关联节点将同步删除。`, '批量删除', { type: 'warning' })
      const chainCodes = this.selectedRows.map(r => r.chainCode)
      const res = await api.post('/chain/batchDelete', { chainCodes })
      Message.success(`删除完成: 成功${res.data.successCount}条，失败${res.data.failCount}条`)
      this.clearSelection()
      this.loadChains()
    },
    async batchExecute() {
      if (!this.selectedRows.length) return
      const chainCodes = this.selectedRows.map(r => r.chainCode)
      const res = await api.post('/execute/batchRun', { chainCodes })
      const results = res.data || []
      const started = results.filter(r => r.status === 'started').length
      const failed = results.filter(r => r.status === 'failed').length
      Message.success(`执行启动: ${started}条成功，${failed}条失败`)
      this.clearSelection()
    }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* ── Card Wrapper ── */
::v-deep .el-card {
  border-radius: 16px;
  overflow: visible;
  box-shadow:
    0 4px 24px rgba(99, 102, 241, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.08);
}

::v-deep .el-card__header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(129, 140, 248, 0.02));
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
  color: #1e1b4b;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Primary Button ── */
::v-deep .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 20px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

::v-deep .el-button--primary:hover {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.45);
  transform: translateY(-1px);
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  flex-wrap: wrap;
}

.filter-bar ::v-deep .el-input__inner {
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d0d5dd;
}

.filter-bar ::v-deep .el-button {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-bar ::v-deep .el-button:hover {
  transform: translateY(-1px);
}

/* ── Batch Bar ── */
.batch-bar {
  margin-top: 16px;
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(16, 185, 129, 0.04));
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
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
  color: #6366f1;
  font-weight: 600;
  font-size: 14px;
}

/* ── Table ── */
::v-deep .el-table {
  border-radius: 0 0 12px 12px;
  overflow: visible;
  font-size: 13px;
}

::v-deep .el-table th {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(129, 140, 248, 0.04)) !important;
  color: #4338ca !important;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
}

::v-deep .el-table td {
  border-bottom: 1px solid rgba(99, 102, 241, 0.06);
  padding: 5px 0 !important;
}

::v-deep .el-table th {
  padding: 7px 0 !important;
}

::v-deep .el-table--striped .el-table__body tr.el-table__row--striped {
  background: rgba(99, 102, 241, 0.02);
}

::v-deep .el-table tbody tr:hover > td {
  background: rgba(99, 102, 241, 0.05) !important;
}

/* ── Fixed Column - Action Column ── */
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

::v-deep .el-table .el-table__fixed-right-wrapper .el-table__header th:last-child,
::v-deep .el-table .el-table__fixed-right-wrapper .el-table__header th.action-column {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.06)) !important;
  color: #4338ca !important;
}

::v-deep .el-table .el-table__fixed-right-wrapper {
  background: transparent !important;
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
  position: relative;
  overflow: visible;
}

.action-btns ::v-deep .el-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.action-btns ::v-deep .el-button:hover::after {
  opacity: 1;
}

.action-btns ::v-deep .el-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-btns ::v-deep .el-button:active {
  transform: translateY(0) scale(0.98);
}

.action-btns ::v-deep .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  color: #fff;
}

.action-btns ::v-deep .el-button--primary:hover {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.action-btns ::v-deep .el-button--success {
  background: linear-gradient(135deg, #10b981, #34d399);
  border: none;
  color: #fff;
}

.action-btns ::v-deep .el-button--success:hover {
  background: linear-gradient(135deg, #059669, #10b981);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
}

.action-btns ::v-deep .el-button--danger {
  background: linear-gradient(135deg, #ef4444, #f87171);
  border: none;
  color: #fff;
}

.action-btns ::v-deep .el-button--danger:hover {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
}

.action-btns ::v-deep .el-button:not(.el-button--primary):not(.el-button--success):not(.el-button--danger) {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.action-btns ::v-deep .el-button:not(.el-button--primary):not(.el-button--success):not(.el-button--danger):hover {
  border-color: #6366f1;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}

/* ── Table Row Animation ── */
::v-deep .el-table tbody tr {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

::v-deep .el-table tbody tr:hover {
  transform: scale(1.002);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

/* ── Tags ── */
::v-deep .el-tag {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Dialog ── */
::v-deep .el-dialog {
  border-radius: 16px;
  overflow: hidden;
}

::v-deep .el-dialog__header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
}

::v-deep .el-dialog__body {
  padding: 24px;
}

::v-deep .el-dialog__footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(99, 102, 241, 0.08);
}

::v-deep .el-form-item__label {
  font-weight: 500;
  color: #4338ca;
}

::v-deep .el-input__inner,
::v-deep .el-textarea__inner {
  border-radius: 10px;
  background: #fff;
  border: 1px solid #d0d5dd;
  box-shadow: none;
}

::v-deep .el-input__inner:hover,
::v-deep .el-textarea__inner:hover {
  border-color: #a5b4fc;
}

::v-deep .el-input__inner:focus,
::v-deep .el-textarea__inner:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  border-color: #6366f1;
}

/* ── Pagination ── */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}

::v-deep .el-pagination .el-pager li.active {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border-radius: 8px;
}

::v-deep .el-pagination .el-pager li {
  border-radius: 8px;
  min-width: 32px;
}
</style>
