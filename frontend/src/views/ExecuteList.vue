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
            <span style="color:#67c23a">{{ row.successCount || 0 }}成功</span> /
            <span style="color:#f56c6c">{{ row.failCount || 0 }}失败</span> /
            <span style="color:#909399">{{ row.skipCount || 0 }}跳过</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push('/execute/detail/' + row.executionId)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api'

const records = ref([])
const filter = ref({ chainCode: '', status: '' })
const dateRange = ref(null)

const loadRecords = async () => {
  const params = { ...filter.value, pageNo: 1, pageSize: 50 }
  if (dateRange.value) {
    params.startTime = dateRange.value[0]
    params.endTime = dateRange.value[1]
  }
  const res = await api.get('/execute/list', { params })
  records.value = res.data?.list || []
}

const formatTime = (t) => t ? new Date(t).toLocaleString() : '-'
const statusType = (s) => ({ RUNNING: 'warning', SUCCESS: 'success', FAILED: 'danger' }[s] || 'info')
const statusText = (s) => ({ RUNNING: '运行中', SUCCESS: '成功', FAILED: '失败' }[s] || s)

onMounted(loadRecords)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.filter-bar { display: flex; align-items: center; }
</style>
