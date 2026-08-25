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
        <el-select v-model="filter.priority" placeholder="优先级" clearable style="width:120px;margin-left:10px">
          <el-option label="P0 核心回归" :value="0" />
          <el-option label="P1 常规回归" :value="1" />
          <el-option label="P2 低频验证" :value="2" />
        </el-select>
        <el-popover trigger="click" :width="320" placement="bottom">
          <template #reference>
            <el-button style="margin-left:10px">
              <span v-if="selectedCategoryNames.length === 0">选择分类</span>
              <span v-else>已选分类 {{ selectedCategoryNames.length }} 项</span>
            </el-button>
          </template>
          <div class="cat-popover">
            <div class="cat-popover-head">
              <span class="cat-popover-title">选择分类（可多选）</span>
              <el-button v-if="filter.categoryIds.length" link type="primary" size="small" @click="clearCategoryFilter">清除</el-button>
            </div>
            <CategoryTree mode="select" multiple v-model="filter.categoryIds" />
            <div v-if="selectedCategoryNames.length" class="cat-selected">
              <el-tag v-for="name in selectedCategoryNames" :key="name" size="small" closable
                @close="removeCategoryByName(name)" class="cat-tag">{{ name }}</el-tag>
            </div>
          </div>
        </el-popover>
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
        <el-table-column label="分类" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.categoryId != null" size="small" class="cat-tag">{{ getCategoryPath(row.categoryId) }}</el-tag>
            <span v-else class="muted-text">-</span>
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
        <el-table-column label="操作" width="80" fixed="right" align="center" class-name="action-column">
          <template #default="{ row }">
            <ActionMenu
              :items="[
                { label: '编排', command: 'edit-flow', icon: Edit },
                { label: '执行', command: 'execute', icon: VideoPlay, divided: true },
                { label: '复制', command: 'copy', icon: CopyDocument },
                { label: '编辑', command: 'edit', icon: Setting },
                { label: '删除', command: 'delete', icon: Delete, divided: true, danger: true }
              ]"
              @command="(cmd) => onChainCommand(cmd, row)"
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
          @size-change="loadChains"
          @current-change="loadChains"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
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
        <el-form-item label="分类">
          <div class="cat-form-item">
            <el-tag v-if="form.categoryId != null" size="small" class="cat-tag">
              {{ categoryTreeMap[form.categoryId] || '已选择' }}
            </el-tag>
            <span v-else class="muted-text">未选择分类</span>
            <el-button v-if="form.categoryId != null" link type="primary" size="small" @click="form.categoryId = null">清除</el-button>
          </div>
          <div class="cat-tree-box">
            <CategoryTree mode="select" :key="dialogVisible" v-model="form.categoryId" />
          </div>
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

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, VideoPlay, CopyDocument, Setting, Delete } from '@element-plus/icons-vue'
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'

const router = useRouter()

const chains = ref([])
const filter = ref({ chainName: '', executeMode: null, priority: null, categoryIds: [] })
const pageNo = ref(1)
const pageSize = ref(10)
const total = ref(0)
const dialogVisible = ref(false)
const dialogTitle = ref('新增链路')
const form = ref({ chainName: '', executeMode: 1, description: '', categoryId: null, priority: 2, isEdit: false })
const selectedRows = ref([])
const tableRef = ref(null)
const categoryTreeMap = ref({})      // id -> name
const categoryPathMap = ref({})      // id -> "父 / 子"
const loadCategoryTreeMap = async () => {
  try {
    const res = await api.get('/category/tree')
    const flat = {}
    const pathMap = {}
    const walk = (nodes, parentPath) => (nodes || []).forEach(n => {
      flat[n.id] = n.categoryName
      const full = parentPath ? parentPath + ' / ' + n.categoryName : n.categoryName
      pathMap[n.id] = full
      if (n.children) walk(n.children, full)
    })
    walk(res.data || [], '')
    categoryTreeMap.value = flat
    categoryPathMap.value = pathMap
  } catch (e) { /* ignore */ }
}
const getCategoryPath = (id) => {
  if (id == null) return '-'
  return categoryPathMap.value[id] || categoryTreeMap.value[id] || '-'
}
const selectedCategoryNames = computed(() =>
  filter.value.categoryIds.map(id => categoryTreeMap.value[id] ?? id)
)
const removeCategoryByName = (name) => {
  const id = Object.keys(categoryTreeMap.value).find(k => categoryTreeMap.value[k] === name)
  if (id != null) filter.value.categoryIds = filter.value.categoryIds.filter(x => String(x) !== String(id))
}
const clearCategoryFilter = () => { filter.value.categoryIds = [] }

const loadChains = async () => {
  const params = {
    chainName: filter.value.chainName,
    executeMode: filter.value.executeMode,
    priority: filter.value.priority,
    pageNo: pageNo.value,
    pageSize: pageSize.value
  }
  if (filter.value.categoryIds.length) params.categoryId = filter.value.categoryIds.join(',')
  const res = await api.get('/chain/list', { params })
  chains.value = res.data?.list || []
  total.value = res.data?.total || 0
}

const resetFilter = () => {
  filter.value = { chainName: '', executeMode: null, priority: null, categoryIds: [] }
  pageNo.value = 1
  loadChains()
}

const formatTime = (t) => {
  if (!t) return '-'
  return new Date(t).toLocaleString()
}

const showCreateDialog = () => {
  dialogTitle.value = '新增链路'
  form.value = { chainName: '', executeMode: 1, description: '', categoryId: null, priority: 2, isEdit: false }
  dialogVisible.value = true
}

const editChain = (row) => {
  dialogTitle.value = '编辑链路'
  form.value = { ...row, isEdit: true }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.chainName) {
    ElMessage.warning('请输入链路名称')
    return
  }
  if (form.value.isEdit) {
    await api.post('/chain/edit', form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/chain/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadChains()
}

const copyChain = async (chainCode) => {
  await api.post('/chain/copy', { chainCode })
  ElMessage.success('复制成功')
  loadChains()
}

const deleteChain = async (chainCode) => {
  await ElMessageBox.confirm('确定删除该链路？关联节点将同步删除。', '提示', { type: 'warning' })
  await api.post('/chain/delete', null, { params: { chainCode } })
  ElMessage.success('删除成功')
  loadChains()
}

const executeChain = async (chainCode) => {
  const res = await api.post('/execute/run', { chainCode })
  ElMessage.success('执行已启动，执行ID: ' + res.data.executionId)
}

const onChainCommand = (cmd, row) => {
  switch (cmd) {
    case 'edit-flow': router.push('/chain/edit/' + row.chainCode); break
    case 'execute': executeChain(row.chainCode); break
    case 'copy': copyChain(row.chainCode); break
    case 'edit': editChain(row); break
    case 'delete': deleteChain(row.chainCode); break
  }
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
}

const batchDelete = async () => {
  if (!selectedRows.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条链路？关联节点将同步删除。`, '批量删除', { type: 'warning' })
  const chainCodes = selectedRows.value.map(r => r.chainCode)
  const res = await api.post('/chain/batchDelete', { chainCodes })
  ElMessage.success(`删除完成: 成功${res.data.successCount}条，失败${res.data.failCount}条`)
  clearSelection()
  loadChains()
}

const batchExecute = async () => {
  if (!selectedRows.value.length) return
  const chainCodes = selectedRows.value.map(r => r.chainCode)
  const res = await api.post('/execute/batchRun', { chainCodes })
  const results = res.data || []
  const submitted = results.filter(r => r.status === 'started').length
  const rejected = results.filter(r => r.status === 'failed').length
  if (rejected > 0) {
    ElMessage.warning(`已提交 ${submitted} 条执行任务，${rejected} 条启动失败（链路不存在或无节点配置）`)
  } else {
    ElMessage.success(`已提交 ${submitted} 条执行任务，最终结果请到「执行记录」中查看`)
  }
  clearSelection()
}

onMounted(() => { loadCategoryTreeMap(); loadChains() })
</script>

<style scoped>
/* 统一字体走全局 Inter 令牌，不再单独 import */

/* ── Card Wrapper ── */
:deep(.el-card) {
  border-radius: var(--sb-radius-lg, 12px);
  overflow: visible;
  box-shadow: var(--sb-shadow-2, 0 8px 24px rgba(0, 0, 0, 0.08));
  border: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
}

:deep(.el-card__header) {
  padding: 18px 24px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06));
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
  color: var(--text, #1c1c1c);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Primary Button ── */
:deep(.el-button--primary) {
  background: linear-gradient(135deg, var(--primary, #3ecf8e), var(--primary-gradient-end, #5db8a7));
  border: none;
  border-radius: var(--sb-radius-sm, 6px);
  font-weight: 600;
  font-size: 14px;
  color: var(--text-on-primary, #ffffff);
  box-shadow: 0 2px 8px var(--sb-accent-bg-2, rgba(62, 207, 142, 0.18));
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.el-button--primary:hover) {
  box-shadow: 0 4px 16px var(--sb-shadow-accent, rgba(62, 207, 142, 0.3));
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

.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select .el-input__wrapper) {
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

.filter-bar :deep(.el-button:hover) {
  transform: translateY(-1px);}

/* ── Category Popover (选择分类) ── */
.cat-popover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cat-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cat-popover-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #1c1c1c);
}
.cat-selected {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--sb-border-strong, rgba(0, 0, 0, 0.1));
}
.cat-tag {
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.12));
  border-color: var(--sb-accent-border, rgba(62, 207, 142, 0.3));
  color: var(--primary-deep, #047857);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted-text {
  color: var(--text-mute, #9ca3af);
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
  border: 1px solid var(--sb-border-strong, rgba(0, 0, 0, 0.16));
  border-radius: var(--sb-radius-sm, 6px);
  padding: 4px 8px;
  background: var(--surface, #ffffff);
}

/* ── Batch Bar ── */
.batch-bar {
  margin-top: 16px;
  padding: 14px 20px;
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06));
  border: 1px solid var(--sb-accent-border, rgba(62, 207, 142, 0.20));
  border-radius: var(--sb-radius-md, 8px);
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
  color: var(--primary-deep, #24b47e);
  font-weight: 600;
  font-size: 14px;
}

/* ── Table ── */
:deep(.el-table) {
  border-radius: 0 0 var(--sb-radius-lg, 12px) var(--sb-radius-lg, 12px);
  overflow: visible;
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

/* ── Fixed Column - Action Column ── */
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

:deep(.el-table .el-table__fixed-right-wrapper .el-table__header th:last-child),
:deep(.el-table .el-table__fixed-right-wrapper .el-table__header th.action-column) {
  background: var(--sb-accent-bg, rgba(62, 207, 142, 0.06)) !important;
  color: var(--text-secondary, #3f3f46) !important;
}

:deep(.el-table .el-table__fixed-right-wrapper) {
  background: var(--surface, #ffffff) !important;
}

/* ── Tags ── */
:deep(.el-tag) {
  border-radius: 8px;
  font-weight: 500;
  padding: 2px 10px;
  font-size: 12px;
}

/* ── Dialog ── */
:deep(.el-dialog) {
  border-radius: var(--sb-radius-lg, 12px);
  overflow: hidden;
  background: var(--surface, #ffffff);
}

:deep(.el-dialog__header) {
  padding: 18px 24px;
  border-bottom: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
}

:deep(.el-dialog__body) {
  padding: 24px;
  color: var(--text, #1c1c1c);
}

:deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid var(--sb-border, rgba(0, 0, 0, 0.10));
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-secondary, #3f3f46);
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  border-radius: var(--sb-radius-sm, 6px);
  background: var(--surface, #ffffff);
  border: 1px solid var(--sb-border-strong, rgba(0, 0, 0, 0.16));
  box-shadow: none;
  color: var(--text, #1c1c1c);
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__inner:hover) {
  border-color: var(--sb-accent-soft-2, rgba(62, 207, 142, 0.55));
}

:deep(.el-input__wrapper.is-focus),
:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 2px var(--sb-accent-bg-2, rgba(62, 207, 142, 0.16));
  border-color: var(--primary, #3ecf8e);
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
</style>
