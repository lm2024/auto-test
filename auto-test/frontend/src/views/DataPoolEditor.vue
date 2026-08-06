<template>
  <div>
    <t-card>
      <template #header>
        <div class="card-header">
          <div>
            <t-button theme="primary" variant="outline" size="small" @click="goBack">← 返回</t-button>
            <span style="margin-left:10px;font-weight:500">{{ pool.poolName || '数据池' }}</span>
            <t-tag size="small" style="margin-left:8px">{{ pool.poolCode }}</t-tag>
          </div>
          <div>
            <t-button size="small" @click="importCsv">📥 导入 CSV</t-button>
            <t-button size="small" @click="exportCsv">📤 导出 CSV</t-button>
            <t-button theme="primary" size="small" @click="addRow">+ 添加行</t-button>
          </div>
        </div>
      </template>

      <!-- 说明 -->
      <div class="editor-tip">
        💡 每行是一组测试参数。执行时第 1 轮用第 1 行，第 2 轮用第 2 行，以此类推。修改后自动保存。
      </div>

      <div v-if="columns.length > 0" class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="row-num-col">#</th>
              <th v-for="col in columns" :key="col.name">
                {{ col.label || col.name }}
                <span class="col-type">{{ col.type }}</span>
              </th>
              <th class="action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="row.id">
              <td class="row-num">{{ row.rowIndex + 1 }}</td>
              <td v-for="col in columns" :key="col.name">
                <t-input
                  v-model="row._data[col.name]"
                  size="small"
                  borderless
                  @blur="saveRow(row)"
                  :placeholder="col.label"
                />
              </td>
              <td class="action-col">
                <t-button size="small" theme="danger" variant="text" @click="deleteRow(row)">删除</t-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">暂无数据</div>
        <div class="empty-desc">点击右上角「+ 添加行」添加测试数据，或通过 CSV 文件批量导入</div>
        <t-button theme="primary" size="small" @click="addRow" style="margin-top:12px">添加第一行数据</t-button>
      </div>

      <div class="pagination-bar">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <!-- CSV 导入对话框 -->
    <t-dialog v-model:visible="importDialogVisible" header="导入 CSV" width="500px">
      <div class="import-hint">
        <p>CSV 文件第一行为表头（字段名），后续行为数据。</p>
        <p>当前列定义: {{ columns.map(c => c.name).join(', ') }}</p>
      </div>
      <t-upload
        v-model="importFiles"
        :auto-upload="false"
        accept=".csv"
        theme="file"
        :max="1"
      />
      <template #footer>
        <t-button @click="importDialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="doImport" :loading="importing">导入</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import api from '../api'

const route = useRoute()
const router = useRouter()
const poolCode = route.params.poolCode

const pool = ref({})
const columns = ref([])
const rows = ref([])
const total = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)
const importDialogVisible = ref(false)
const importFiles = ref([])
const importing = ref(false)

const goBack = () => router.push('/datapool/list')

const loadPool = async () => {
  try {
    const res = await api.get('/datapool/detail', { params: { poolCode } })
    if (res.data.code === 200) {
      pool.value = res.data.data
      try { columns.value = JSON.parse(pool.value.columnDefs || '[]') } catch { columns.value = [] }
    }
  } catch (e) { MessagePlugin.error('加载数据池失败') }
}

const loadRows = async () => {
  try {
    const res = await api.get('/datapool/row/list', {
      params: { poolId: pool.value.id, pageNo: pageNo.value, pageSize: pageSize.value }
    })
    if (res.data.code === 200) {
      const rawList = res.data.data.list || []
      rows.value = rawList.map(r => {
        let data = {}
        try { data = JSON.parse(r.rowData || '{}') } catch { data = {} }
        return { ...r, _data: data }
      })
      total.value = res.data.data.total || 0
    }
  } catch (e) { MessagePlugin.error('加载行数据失败') }
}

const onPageChange = (info) => {
  pageNo.value = info.current
  pageSize.value = info.pageSize
  loadRows()
}

const addRow = async () => {
  try {
    const rowData = {}
    columns.value.forEach(c => { rowData[c.name] = '' })
    await api.post('/datapool/row/add', {
      poolId: pool.value.id,
      rowData: JSON.stringify(rowData)
    })
    MessagePlugin.success('添加成功')
    loadRows()
  } catch (e) { MessagePlugin.error('添加失败') }
}

const saveRow = async (row) => {
  try {
    await api.put('/datapool/row/update', {
      id: row.id,
      rowData: JSON.stringify(row._data)
    })
  } catch (e) { /* 静默保存 */ }
}

const deleteRow = async (row) => {
  try {
    await api.delete('/datapool/row/delete', { params: { id: row.id } })
    MessagePlugin.success('删除成功')
    loadRows()
  } catch (e) { MessagePlugin.error('删除失败') }
}

const importCsv = () => { importFiles.value = []; importDialogVisible.value = true }

const doImport = async () => {
  if (importFiles.value.length === 0) return MessagePlugin.warning('请选择 CSV 文件')
  importing.value = true
  try {
    const file = importFiles.value[0].raw || importFiles.value[0]
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return MessagePlugin.warning('CSV 至少需要表头和一行数据')
    const headers = lines[0].split(',').map(h => h.trim())
    const rowDataList = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const row = {}
      headers.forEach((h, j) => { row[h] = (values[j] || '').trim() })
      rowDataList.push(row)
    }
    await api.post('/datapool/import', null, {
      params: { poolId: pool.value.id }
    })
    // 使用行级导入
    for (const rd of rowDataList) {
      await api.post('/datapool/row/add', {
        poolId: pool.value.id,
        rowData: JSON.stringify(rd)
      })
    }
    MessagePlugin.success(`导入成功，共 ${rowDataList.length} 行`)
    importDialogVisible.value = false
    loadRows()
  } catch (e) {
    MessagePlugin.error('导入失败: ' + (e.message || ''))
  } finally {
    importing.value = false
  }
}

const exportCsv = () => {
  if (columns.value.length === 0 || rows.value.length === 0) {
    return MessagePlugin.warning('无数据可导出')
  }
  const header = columns.value.map(c => c.name).join(',')
  const body = rows.value.map(r => columns.value.map(c => r._data[c.name] || '').join(',')).join('\n')
  const csv = header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${poolCode}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await loadPool()
  await loadRows()
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.editor-tip { padding: 8px 12px; margin-bottom: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 12px; color: #0c4a6e; }
.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th, .data-table td { border: 1px solid #eee; padding: 6px 8px; text-align: left; }
.data-table th { background: #f5f5f5; font-weight: 500; white-space: nowrap; }
.row-num-col { width: 40px; text-align: center; }
.row-num { text-align: center; color: #999; font-size: 12px; }
.action-col { width: 60px; text-align: center; }
.col-type { font-size: 10px; color: #999; margin-left: 4px; font-weight: normal; }
.empty-state { text-align: center; padding: 48px 20px; }
.empty-icon { font-size: 48px; margin-bottom: 8px; }
.empty-title { font-size: 16px; font-weight: 500; margin-bottom: 4px; }
.empty-desc { font-size: 13px; color: #999; }
.pagination-bar { display: flex; justify-content: flex-end; margin-top: 15px; }
.import-hint { margin-bottom: 12px; font-size: 13px; color: #666; }
.import-hint p { margin: 4px 0; }
</style>
