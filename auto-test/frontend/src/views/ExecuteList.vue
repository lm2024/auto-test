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
        <el-popover trigger="click" :width="300">
          <template #reference>
            <el-button style="margin-left:10px">
              {{ filter.categoryId ? '已选分类' : '选择分类' }}
            </el-button>
          </template>
          <CategoryTree mode="select" v-model="filter.categoryId" />
        </el-popover>
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
        <el-table-column label="操作" width="80" fixed="right" align="center" class-name="action-column">
          <template #default="{ row }">
            <ActionMenu
              :items="[{ label: '详情', command: 'detail', icon: View }]"
              @command="(cmd) => onRecordCommand(cmd, row)"
            />
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadRecords"
          @current-change="loadRecords"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { View } from '@element-plus/icons-vue'
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'

const router = useRouter()

const records = ref([])
const filter = ref({ chainCode: '', status: '', categoryId: null })
const dateRange = ref(null)
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)

const loadRecords = async () => {
  const params = { ...filter.value, pageNo: pageNo.value, pageSize: pageSize.value }
  if (dateRange.value) {
    params.startTime = dateRange.value[0]
    params.endTime = dateRange.value[1]
  }
  if (!params.categoryId) delete params.categoryId
  const res = await api.get('/execute/list', { params })
  records.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const formatTime = (t) => t ? new Date(t).toLocaleString() : '-'
const statusType = (s) => ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger' }[s] || 'info')
const statusText = (s) => ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' }[s] || s)

const onRecordCommand = (cmd, row) => {
  if (cmd === 'detail') router.push('/execute/detail/' + row.executionId)
}

onMounted(loadRecords)
</script>

<style scoped>
/* ── Card ── */
:deep(.el-card) {
  border-radius: var(--sb-radius-lg, 12px);
  box-shadow: var(--sb-shadow-2, 0 8px 24px rgba(0, 0, 0, 0.08));
  border: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
}

:deep(.el-card__header) {
  padding: 18px 24px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06));
}

.card-header > span {
  font-size: 18px;
  font-weight: 700;
  color: var(--text, #1c1c1c);
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  flex-wrap: wrap;
}

.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select .el-input__wrapper),
.filter-bar :deep(.el-date-editor) {
  border-radius: var(--sb-radius-sm, 6px);
  background: var(--surface, #ffffff);
  border: 1px solid var(--sb-border-strong, rgba(0, 0, 0, 0.16));
  box-shadow: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.filter-bar :deep(.el-input__wrapper:hover),
.filter-bar :deep(.el-select .el-input__wrapper:hover) {
  border-color: var(--sb-accent-soft-2, rgba(62, 207, 142, 0.55));
}

.filter-bar :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--sb-accent-bg-2, rgba(62, 207, 142, 0.16));
  border-color: var(--primary, #3ecf8e);
}

.filter-bar :deep(.el-button) {
  border-radius: var(--sb-radius-sm, 6px);
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-bar :deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--primary, #3ecf8e), var(--primary-gradient-end, #5db8a7));
  border: none;
  color: var(--text-on-primary, #ffffff);
  box-shadow: 0 2px 8px var(--sb-accent-bg-2, rgba(62, 207, 142, 0.18));
}

.filter-bar :deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--sb-shadow-accent, rgba(62, 207, 142, 0.3));
  filter: brightness(1.05);
}

/* ── Table ── */
:deep(.el-table) {
  border-radius: 0 0 var(--sb-radius-lg, 12px) var(--sb-radius-lg, 12px);
  font-size: 13px;
  --el-table-border-color: var(--sb-border-subtle, rgba(0, 0, 0, 0.06));
  --el-table-header-bg-color: var(--sb-accent-bg, rgba(62, 207, 142, 0.06));
  --el-table-row-hover-bg-color: var(--sb-accent-bg-2, rgba(62, 207, 142, 0.10));
}

:deep(.el-table th.el-table__cell) {
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06)) !important;
  color: var(--text-secondary, #3f3f46) !important;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10)) !important;
  padding: 7px 0 !important;
}

:deep(.el-table td.el-table__cell) {
  border-bottom: 1px solid var(--sb-border-subtle, rgba(0, 0, 0, 0.06));
  padding: 5px 0 !important;
  color: var(--text, #1c1c1c);
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.04));
}

:deep(.el-table tbody tr:hover > td.el-table__cell) {
  background: var(--sb-accent-bg-2, rgba(62, 207, 142, 0.10)) !important;
}

/* ── Fixed Column ── */
:deep(.el-table .el-table__fixed-right) {
  z-index: 10 !important;
  box-shadow: -4px 0 12px var(--sb-shadow-accent, rgba(62, 207, 142, 0.12)) !important;
  background: var(--surface, #ffffff);
}

:deep(.el-table .el-table__fixed-right::before) {
  display: none !important;
}

:deep(.el-table .el-table__fixed-right-patch) {
  background: var(--surface, #ffffff) !important;
}

:deep(.el-table .action-column),
:deep(.el-table td.action-column) {
  background: var(--surface, #ffffff) !important;
  padding: 8px 0 !important;
  height: auto !important;
}

/* ── Pagination ── */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}

:deep(.el-pagination) {
  --el-pagination-button-bg-color: var(--surface, #ffffff);
  --el-pagination-hover-color: var(--primary-deep, #24b47e);
}

:deep(.el-pagination .el-pager li.is-active) {
  background: linear-gradient(135deg, var(--primary, #3ecf8e), var(--primary-gradient-end, #5db8a7));
  color: var(--text-on-primary, #ffffff);
  border-radius: 8px;
}

:deep(.el-pagination .el-pager li) {
  border-radius: 8px;
  min-width: 32px;
}

/* ── Status Tags ── */
:deep(.el-tag) {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Node Stats ── */
:deep(.el-table td .success-count) { color: var(--sb-success, #10b981); font-weight: 600; }
:deep(.el-table td .fail-count) { color: var(--sb-danger, #ef4444); font-weight: 600; }
:deep(.el-table td .skip-count) { color: var(--text-mute, #71717a); font-weight: 500; }
</style>
