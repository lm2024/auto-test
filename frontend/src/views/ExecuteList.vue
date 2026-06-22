<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>执行记录查询</span>
        </div>
      </template>

      <div class="filter-bar">
        <el-input v-model="filter.chainCode" placeholder="链路编码" clearable style="width:200px" />
        <el-select v-model="filter.status" placeholder="执行状态" clearable style="width:120px;margin-left:10px">
          <el-option label="运行中" value="RUNNING" />
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至"
          start-placeholder="开始日期" end-placeholder="结束日期" style="margin-left:10px" />
        <el-button type="primary" style="margin-left:10px" @click="loadRecords">查询</el-button>
      </div>

      <el-table :data="records" border stripe style="margin-top:15px">
        <el-table-column prop="executionId" label="执行ID" width="200" />
        <el-table-column prop="chainName" label="关联链路" width="200" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">{{ formatTime(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="总耗时" width="120">
          <template #default="{ row }">{{ row.totalCostMs ? row.totalCostMs + 'ms' : '-' }}</template>
        </el-table-column>
        <el-table-column label="节点统计" width="150">
          <template #default="{ row }">
            <span class="success-count">{{ row.successCount || 0 }}成功</span> /
            <span class="fail-count">{{ row.failCount || 0 }}失败</span> /
            <span class="skip-count">{{ row.skipCount || 0 }}跳过</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right" align="center" class-name="action-column">
          <template #default="{ row, $index }">
            <div class="action-btns" :style="{ background: $index % 2 === 1 ? '#fafafe' : '#ffffff' }">
              <el-button size="small" @click="$router.push('/execute/detail/' + row.executionId)">详情</el-button>
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
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'ExecuteList',
  data() {
    return {
      records: [],
      filter: { chainCode: '', status: '' },
      dateRange: null,
      pageNo: 1,
      pageSize: 10,
      total: 0
    }
  },
  mounted() {
    this.loadRecords()
  },
  methods: {
    async loadRecords() {
      const params = { ...this.filter, pageNo: this.pageNo, pageSize: this.pageSize }
      if (this.dateRange) {
        params.startTime = this.dateRange[0]
        params.endTime = this.dateRange[1]
      }
      const res = await api.get('/execute/list', { params })
      this.records = (res.data && res.data.list) || []
      this.total = (res.data && res.data.total) || 0
    },
    onPageSizeChange(val) { this.pageSize = val; this.loadRecords() },
    onPageChange(val) { this.pageNo = val; this.loadRecords() },
    formatTime(t) { return t ? new Date(t).toLocaleString() : '-' },
    statusType(s) { return { RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger' }[s] || 'info' },
    statusText(s) { return { RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' }[s] || s }
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* ── Card ── */
::v-deep .el-card {
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(99, 102, 241, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.08);
}

::v-deep .el-card__header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.04), rgba(129, 140, 248, 0.02));
}

.card-header > span {
  font-size: 18px;
  font-weight: 700;
  color: #1e1b4b;
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
  box-shadow: none;
}

.filter-bar ::v-deep .el-button {
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-bar ::v-deep .el-button--primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.filter-bar ::v-deep .el-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}

/* ── Table ── */
::v-deep .el-table {
  border-radius: 0 0 12px 12px;
  font-size: 13px;
}

::v-deep .el-table th {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(129, 140, 248, 0.04)) !important;
  color: #4338ca !important;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.1) !important;
  padding: 7px 0 !important;
}

::v-deep .el-table td {
  border-bottom: 1px solid rgba(99, 102, 241, 0.06);
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

::v-deep .el-table--striped .el-table__body tr.el-table__row--striped {
  background: rgba(99, 102, 241, 0.02);
}

::v-deep .el-table tbody tr:hover > td {
  background: rgba(99, 102, 241, 0.05) !important;
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

/* ── Status Tags ── */
::v-deep .el-tag {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Node Stats ── */
::v-deep .el-table td .success-count { color: #10b981; font-weight: 600; }
::v-deep .el-table td .fail-count { color: #ef4444; font-weight: 600; }
::v-deep .el-table td .skip-count { color: #6b7280; font-weight: 500; }
</style>
