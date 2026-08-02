<template>
  <div>
    <t-card>
      <template #title>
        <div class="card-header">
          <span>执行记录查询</span>
        </div>
      </template>

      <div class="filter-bar">
        <t-input v-model="filter.chainCode" placeholder="链路编码" clearable style="width:200px" />
        <t-select v-model="filter.status" placeholder="执行状态" clearable style="width:120px;margin-left:10px">
          <t-option label="运行中" value="RUNNING" />
          <t-option label="成功" value="SUCCESS" />
          <t-option label="失败" value="FAILED" />
        </t-select>
        <t-date-range-picker v-model="dateRange" style="margin-left:10px" />
        <t-button style="margin-left:10px" @click="categoryDialogVisible = true">
          {{ filter.categoryId ? '已选分类' : '选择分类' }}
        </t-button>
        <t-button theme="primary" style="margin-left:10px" @click="handleSearch">查询</t-button>
      </div>

      <t-table :data="records" :columns="recordColumns" row-key="executionId" :bordered="true" :stripe="true" style="margin-top:15px" />

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

    <!-- 分类选择弹窗 -->
    <t-dialog :visible="categoryDialogVisible" @update:visible="val => categoryDialogVisible = val" header="选择分类" :width="360" :close-on-overlay-click="false">
      <div class="cat-dialog">
        <div class="cat-dialog-hint">点击分类节点选择，再次点击取消</div>
        <div class="cat-dialog-tree">
          <CategoryTree mode="select" v-model="filter.categoryId" />
        </div>
        <div v-if="filter.categoryId" class="cat-selected">
          <span class="cat-selected-text">已选：{{ categoryName }}</span>
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
  name: 'ExecuteList',
  components: { CategoryTree, ActionMenu },
  data() {
    return {
      records: [],
      filter: { chainCode: '', status: '', categoryId: null },
      categoryDescendantsMap: {},
      categoryNameMap: {},
      categoryDialogVisible: false,
      categoryName: '',
      dateRange: [],
      pageNo: 1,
      pageSize: 10,
      total: 0,
      recordColumns: [
        { colKey: 'executionId', title: '执行ID', width: 200 },
        { colKey: 'chainName', title: '关联链路', width: 200 },
        { colKey: 'status', title: '状态', width: 100, cell: (h, ctx) => h('t-tag', { props: { theme: this.statusType(ctx.row.status) } }, this.statusText(ctx.row.status)) },
        { colKey: 'startTime', title: '开始时间', width: 180, cell: (h, ctx) => this.formatTime(ctx.row.startTime) },
        { colKey: 'totalCostMs', title: '总耗时', width: 120, cell: (h, ctx) => ctx.row.totalCostMs ? ctx.row.totalCostMs + 'ms' : '-' },
        { colKey: 'nodeStats', title: '节点统计', width: 150, cell: (h, ctx) => h('span', {}, [
          h('span', { class: 'success-count' }, (ctx.row.successCount || 0) + '成功'),
          ' / ',
          h('span', { class: 'fail-count' }, (ctx.row.failCount || 0) + '失败'),
          ' / ',
          h('span', { class: 'skip-count' }, (ctx.row.skipCount || 0) + '跳过')
        ]) },
        { colKey: 'op', title: '操作', width: 80, fixed: 'right', align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: { items: [{ label: '详情', command: 'detail' }] },
          on: { command: (cmd) => this.onRecordCommand(cmd, ctx.row) }
        }) }
      ]
    }
  },
  mounted() {
    this.loadCategoryTreeMap()
    this.loadRecords()
  },
  methods: {
    async loadCategoryTreeMap() {
      try {
        const res = await api.get('/category/tree')
        const descendants = {}
        const self = this
        const collectDescendants = function(nodes, acc) {
          ;(nodes || []).forEach(function(n) {
            acc.push(n.id)
            if (n.children) collectDescendants(n.children, acc)
          })
        }
        const nameMap = {}
        const walkNames = function(nodes) {
          ;(nodes || []).forEach(function(n) {
            nameMap[n.id] = n.categoryName
            if (n.children) walkNames(n.children)
          })
        }
        walkNames(res.data || [])
        ;(res.data || []).forEach(function(n) {
          const acc = []
          collectDescendants([n], acc)
          descendants[n.id] = acc
        })
        this.categoryDescendantsMap = descendants
        this.categoryNameMap = nameMap
        if (this.filter.categoryId) this.categoryName = nameMap[this.filter.categoryId] || '' 
      } catch (e) { this.categoryDescendantsMap = {} }
    },
    expandCategoryIds(id) {
      if (id == null) return []
      const sub = this.categoryDescendantsMap && this.categoryDescendantsMap[id]
      if (sub && sub.length) return sub
      return [id]
    },
    async loadRecords() {
      if (this.filter.categoryId && this.categoryNameMap) {
        this.categoryName = this.categoryNameMap[this.filter.categoryId] || ''
      }
      const params = Object.assign({}, this.filter, { pageNo: this.pageNo, pageSize: this.pageSize })
      if (this.dateRange && this.dateRange.length) {
        params.startTime = this.dateRange[0]
        params.endTime = this.dateRange[1]
      }
      if (params.categoryId) {
        params.categoryId = this.expandCategoryIds(params.categoryId).join(',')
      } else {
        delete params.categoryId
      }
      const res = await api.get('/execute/list', { params: params })
      this.records = res.data && res.data.list ? res.data.list : []
      this.total = res.data && res.data.total ? res.data.total : 0
    },
    handlePageChange(page) {
      this.pageNo = page
      this.loadRecords()
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.pageNo = 1
      this.loadRecords()
    },
    handleSearch() {
      this.pageNo = 1
      this.loadRecords()
    },
    clearCategoryFilter() {
      this.filter.categoryId = null
      this.categoryName = ''
      this.loadRecords()
    },
    confirmCategory() {
      this.categoryDialogVisible = false
      this.handleSearch()
    },
    formatTime(t) {
      return t ? new Date(t).toLocaleString() : '-'
    },
    statusType(s) {
      const map = { RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger' }
      return map[s] || 'default'
    },
    statusText(s) {
      const map = { RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' }
      return map[s] || s
    },
    onRecordCommand(cmd, row) {
      if (cmd === 'detail') this.$router.push('/execute/detail/' + row.executionId)
    }
  }
}
</script>

<style scoped>
/* ── Card ── */
::v-deep(.t-card) {
  border-radius: var(--sb-radius-lg, 12px);
  box-shadow: var(--sb-shadow-2, 0 8px 24px rgba(0, 0, 0, 0.08));
  border: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
}

::v-deep(.t-card__header) {
  padding: 18px 24px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06));
}

.card-header {
  font-size: 18px;
  font-weight: 700;
  color: var(--sb-text, #1c1c1c);
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  flex-wrap: wrap;
}

.filter-bar ::v-deep(.t-input),
.filter-bar ::v-deep(.t-select),
.filter-bar ::v-deep(.t-date-range-picker) {
  border-radius: var(--sb-radius-sm, 6px);
}

/* ── Table ── */
::v-deep(.t-table) {
  border-radius: 0 0 var(--sb-radius-lg, 12px) var(--sb-radius-lg, 12px);
  font-size: 13px;
}

::v-deep(.t-table__header th) {
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06)) !important;
  color: var(--sb-text-secondary, #3f3f46) !important;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10)) !important;
}

::v-deep(.t-table__body td) {
  border-bottom: 1px solid var(--sb-border-subtle, rgba(0, 0, 0, 0.06));
  color: var(--sb-text, #1c1c1c);
}

::v-deep(.t-table__row:hover .t-table__cell) {
  background: var(--sb-accent-bg-2, rgba(62, 207, 142, 0.10)) !important;
}

/* ── Pagination ── */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}

::v-deep(.t-pagination .t-pagination__number.t-is-current) {
  background: linear-gradient(135deg, var(--sb-green, #3ecf8e), var(--sb-green-soft, #4ade80));
  color: var(--sb-text-on-green, #0a0a0a);
  border-radius: 8px;
}

::v-deep(.t-pagination .t-pagination__number) {
  border-radius: 8px;
  min-width: 32px;
}

/* ── Status Tags ── */
::v-deep(.t-tag) {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Node Stats ── */
::v-deep(.t-table td .success-count) { color: var(--sb-success, #10b981); font-weight: 600; }
::v-deep(.t-table td .fail-count) { color: var(--sb-danger, #ef4444); font-weight: 600; }
::v-deep(.t-table td .skip-count) { color: var(--sb-text-mute, #71717a); font-weight: 500; }
</style>
