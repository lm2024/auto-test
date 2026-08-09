<template>
  <div>
    <t-card>
      <template #header>
        <PageHeader title="测试链路管理" description="编排、筛选并执行接口测试链路">
          <template #actions><t-button theme="primary" @click="showCreateDialog">新增链路</t-button></template>
        </PageHeader>
      </template>

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
        <t-popup trigger="click" placement="bottom" :overlay-inner-style="{ width: '320px' }">
          <t-button style="margin-left:10px">
            <span v-if="selectedCategoryNames.length === 0">选择分类</span>
            <span v-else>已选分类 {{ selectedCategoryNames.length }} 项</span>
          </t-button>
          <template #content>
            <div class="cat-popover">
              <div class="cat-popover-head">
                <span class="cat-popover-title">选择分类（可多选）</span>
                <t-button v-if="filter.categoryIds.length" variant="text" theme="primary" size="small" @click="clearCategoryFilter">清除</t-button>
              </div>
              <CategoryTree mode="select" multiple v-model="filter.categoryIds" />
              <div v-if="selectedCategoryNames.length" class="cat-selected">
                <t-tag v-for="name in selectedCategoryNames" :key="name" size="small" closable
                  @close="removeCategoryByName(name)" class="cat-tag">{{ name }}</t-tag>
              </div>
            </div>
          </template>
        </t-popup>
        <t-button theme="primary" style="margin-left:10px" @click="loadChains">查询</t-button>
        <t-button @click="resetFilter">重置</t-button>
      </div>

      <div v-if="selectedRows.length > 0" class="batch-bar">
        <span>已选 {{ selectedRows.length }} 条</span>
        <t-button theme="success" size="small" @click="batchExecute">批量执行</t-button>
        <t-button theme="danger" size="small" @click="batchDelete">批量删除</t-button>
        <t-button size="small" @click="clearSelection">取消选择</t-button>
      </div>

      <t-table
        :data="chains"
        :columns="chainColumns"
        row-key="chainCode"
        bordered
        stripe
        style="margin-top:15px"
        :selected-row-keys="selectedRowKeys"
        @select-change="handleSelectionChange"
      >
        <template #executeMode="{ row }">
          <t-tag :theme="row.executeMode === 1 ? 'primary' : 'warning'">
            {{ row.executeMode === 1 ? '全串行' : '分组并行' }}
          </t-tag>
        </template>
        <template #categoryId="{ row }">
          <t-tag v-if="row.categoryId != null" size="small" class="cat-tag">{{ getCategoryPath(row.categoryId) }}</t-tag>
          <span v-else class="muted-text">-</span>
        </template>
        <template #priority="{ row }">
          <t-tag v-if="row.priority === 0" theme="danger" size="small">P0</t-tag>
          <t-tag v-else-if="row.priority === 1" theme="warning" size="small">P1</t-tag>
          <t-tag v-else theme="default" size="small">P2</t-tag>
        </template>
        <template #createTime="{ row }">
          {{ formatTime(row.createTime) }}
        </template>
        <template #operate="{ row }">
          <ActionMenu
            :items="[
              { label: '编排', command: 'edit-flow', icon: EditIcon },
              { label: '执行', command: 'execute', icon: PlayCircleIcon, divided: true },
              { label: '复制', command: 'copy', icon: FileCopyIcon },
              { label: '编辑', command: 'edit', icon: SettingIcon },
              { label: '删除', command: 'delete', icon: DeleteIcon, divided: true, danger: true }
            ]"
            @command="(cmd) => onChainCommand(cmd, row)"
          />
        </template>
      </t-table>

      <div class="pagination-bar">
        <t-pagination
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="[10, 20, 50, 100]"
          :total="total"
          show-jumper
          @change="onPageChange"
        />
      </div>
    </t-card>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="500px">
      <t-form :data="form" label-width="100px">
        <t-form-item label="链路名称" name="chainName">
          <t-input v-model="form.chainName" />
        </t-form-item>
        <t-form-item label="执行模式" name="executeMode">
          <t-select v-model="form.executeMode">
            <t-option label="全串行" :value="1" />
            <t-option label="分组并行" :value="2" />
          </t-select>
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea v-model="form.description" :autosize="{ minRows: 3, maxRows: 3 }" />
        </t-form-item>
        <t-form-item label="分类" name="categoryId">
          <div class="cat-form-item">
            <t-tag v-if="form.categoryId != null" size="small" class="cat-tag">
              {{ categoryTreeMap[form.categoryId] || '已选择' }}
            </t-tag>
            <span v-else class="muted-text">未选择分类</span>
            <t-button v-if="form.categoryId != null" variant="text" theme="primary" size="small" @click="form.categoryId = null">清除</t-button>
          </div>
          <div class="cat-tree-box">
            <CategoryTree mode="select" :key="dialogVisible" v-model="form.categoryId" />
          </div>
        </t-form-item>
        <t-form-item label="优先级" name="priority">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { EditIcon, PlayCircleIcon, FileCopyIcon, SettingIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'
import PageHeader from '../components/PageHeader.vue'

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
const selectedRowKeys = ref([])

const chainColumns = [
  { colKey: 'row-select', type: 'multiple', width: 50 },
  { colKey: 'chainCode', title: '链路编码', width: 200 },
  { colKey: 'chainName', title: '链路名称', width: 200 },
  { colKey: 'executeMode', title: '执行模式', width: 120 },
  { colKey: 'nodeCount', title: '节点数', width: 80 },
  { colKey: 'categoryId', title: '分类', minWidth: 180 },
  { colKey: 'priority', title: '优先级', width: 100 },
  { colKey: 'createTime', title: '创建时间', width: 180 },
  { colKey: 'operate', title: '操作', width: 80, fixed: 'right', align: 'center', className: 'action-column' }
]
const categoryTreeMap = ref({})      // id -> name
const categoryPathMap = ref({})      // id -> "父 / 子"
const loadCategoryTreeMap = async () => {
  // Keep only the small root set for lightweight labels; never materialize the full graph.
  try {
    const res = await api.get('/category/tree', { params: { parentId: 0 } })
    const roots = res.data || []
    categoryTreeMap.value = Object.fromEntries(roots.map(n => [n.id, n.categoryName]))
    categoryPathMap.value = { ...categoryTreeMap.value }
  } catch (e) {
    categoryTreeMap.value = {}
    categoryPathMap.value = {}
  }
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

const onPageChange = (pageInfo) => {
  pageNo.value = pageInfo.current
  pageSize.value = pageInfo.pageSize
  loadChains()
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
    MessagePlugin.warning('请输入链路名称')
    return
  }
  if (form.value.isEdit) {
    await api.post('/chain/edit', form.value)
    MessagePlugin.success('编辑成功')
  } else {
    await api.post('/chain/create', form.value)
    MessagePlugin.success('创建成功')
  }
  dialogVisible.value = false
  loadChains()
}

const copyChain = async (chainCode) => {
  await api.post('/chain/copy', { chainCode })
  MessagePlugin.success('复制成功')
  loadChains()
}

const deleteChain = (chainCode) => {
  const dialog = DialogPlugin.confirm({
    header: '提示',
    body: '确定删除该链路？关联节点将同步删除。',
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      dialog.hide()
      await api.post('/chain/delete', null, { params: { chainCode } })
      MessagePlugin.success('删除成功')
      loadChains()
    }
  })
}

const executeChain = async (chainCode) => {
  const res = await api.post('/execute/run', { chainCode })
  MessagePlugin.success('执行已启动，执行ID: ' + res.data.executionId)
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

const handleSelectionChange = (keys, ctx) => {
  selectedRowKeys.value = keys
  selectedRows.value = ctx?.selectedRowData || []
}

const clearSelection = () => {
  selectedRowKeys.value = []
  selectedRows.value = []
}

const batchDelete = () => {
  if (!selectedRows.value.length) return
  const count = selectedRows.value.length
  const dialog = DialogPlugin.confirm({
    header: '批量删除',
    body: `确定删除选中的 ${count} 条链路？关联节点将同步删除。`,
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      dialog.hide()
      const chainCodes = selectedRows.value.map(r => r.chainCode)
      const res = await api.post('/chain/batchDelete', { chainCodes })
      MessagePlugin.success(`删除完成: 成功${res.data.successCount}条，失败${res.data.failCount}条`)
      clearSelection()
      loadChains()
    }
  })
}

const batchExecute = async () => {
  if (!selectedRows.value.length) return
  const chainCodes = selectedRows.value.map(r => r.chainCode)
  const res = await api.post('/execute/batchRun', { chainCodes })
  const results = res.data || []
  const submitted = results.filter(r => r.status === 'started').length
  const rejected = results.filter(r => r.status === 'failed').length
  if (rejected > 0) {
    MessagePlugin.warning(`已提交 ${submitted} 条执行任务，${rejected} 条启动失败（链路不存在或无节点配置）`)
  } else {
    MessagePlugin.success(`已提交 ${submitted} 条执行任务，最终结果请到「执行记录」中查看`)
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
  background: linear-gradient(135deg, var(--primary, #3ecf8e), var(--primary-soft, #4ade80));
  border: none;
  border-radius: var(--sb-radius-sm, 6px);
  font-weight: 600;
  font-size: 14px;
  color: var(--text-on-green, #0a0a0a);
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
  background: linear-gradient(135deg, var(--primary, #3ecf8e), var(--primary-soft, #4ade80));
  color: var(--text-on-green, #0a0a0a);
  border-radius: 8px;
}

:deep(.el-pagination .el-pager li) {
  border-radius: 8px;
  min-width: 32px;
}
</style>
