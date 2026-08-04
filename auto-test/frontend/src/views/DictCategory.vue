<template>
  <div>
    <t-card>
      <template #header>
        <div class="card-header">
          <span>分类管理</span>
        </div>
      </template>

      <div class="category-layout">
        <div class="tree-panel">
          <CategoryTree
            ref="categoryTreeRef"
            mode="manage"
            v-model="selectedCategoryId"
            @add-root="showCreateDialog(null)"
            @add-child="showCreateDialog($event.id)"
            @edit="editCategory"
            @delete="deleteCategory"
            @refresh="loadTree"
          />
        </div>

        <div class="detail-panel" v-if="selectedCategoryId">
          <t-descriptions :title="selectedCategory?.categoryName || '分类详情'" :column="1" bordered>
            <t-descriptions-item label="分类ID">{{ selectedCategory?.id }}</t-descriptions-item>
            <t-descriptions-item label="父分类ID">{{ selectedCategory?.parentId || '无 (根节点)' }}</t-descriptions-item>
            <t-descriptions-item label="排序号">{{ selectedCategory?.sortOrder }}</t-descriptions-item>
            <t-descriptions-item label="状态">
              <t-tag :theme="selectedCategory?.status === 1 ? 'success' : 'default'">
                {{ selectedCategory?.status === 1 ? '启用' : '禁用' }}
              </t-tag>
            </t-descriptions-item>
          </t-descriptions>

          <div class="chain-section">
            <div class="chain-header">
              <h4>该分类下的链路</h4>
              <t-button theme="primary" size="small" @click="executeCategoryChains" :disabled="!chains.length">
                执行全部
              </t-button>
            </div>
            <t-table
              :data="chains"
              :columns="chainColumns"
              row-key="chainCode"
              bordered
              stripe
              size="small"
              style="margin-top:10px"
            >
              <template #operate="{ row }">
                <ActionMenu
                  :items="[{ label: '执行', command: 'execute', icon: PlayCircleIcon }]"
                  @command="(cmd) => onDictChainCommand(cmd, row)"
                />
              </template>
            </t-table>
          </div>
        </div>

        <div class="detail-panel empty" v-else>
          <t-empty description="请选择左侧分类查看详情" />
        </div>
      </div>
    </t-card>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" width="500px">
      <t-form :data="form" label-width="100px">
        <t-form-item label="分类名称" name="categoryName">
          <t-input v-model="form.categoryName" />
        </t-form-item>
        <t-form-item label="排序号" name="sortOrder">
          <t-input-number v-model="form.sortOrder" :min="0" />
        </t-form-item>
        <t-form-item label="状态" name="status">
          <t-switch v-model="form.status" :custom-value="[1, 0]" />
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button theme="default" variant="outline" @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { PlayCircleIcon } from 'tdesign-icons-vue-next'
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'

const chainColumns = [
  { colKey: 'chainCode', title: '链路编码', width: 180 },
  { colKey: 'chainName', title: '链路名称', width: 200 },
  { colKey: 'nodeCount', title: '节点数', width: 80 },
  { colKey: 'operate', title: '操作', width: 80, align: 'center' }
]

const categoryTreeRef = ref(null)
const selectedCategoryId = ref(null)
const selectedCategory = ref(null)
const chains = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增分类')
const isEdit = ref(false)
const editId = ref(null)
const form = ref({ categoryName: '', sortOrder: 0, status: 1, parentId: 0 })

const loadTree = () => {
  categoryTreeRef.value?.loadTree()
}

const loadCategoryDetail = async (id) => {
  if (!id) {
    selectedCategory.value = null
    chains.value = []
    return
  }
  try {
    const res = await api.get('/category/detail', { params: { id } })
    selectedCategory.value = res.data
  } catch (e) {
    selectedCategory.value = null
  }
  try {
    const res = await api.get('/chain/list', { params: { categoryId: id, pageNo: 1, pageSize: 100 } })
    chains.value = res.data?.list || []
  } catch (e) {
    chains.value = []
  }
}

watch(selectedCategoryId, (val) => {
  loadCategoryDetail(val)
})

const showCreateDialog = (parentId) => {
  dialogTitle.value = parentId ? '新增子分类' : '新增根分类'
  isEdit.value = false
  editId.value = null
  form.value = { categoryName: '', sortOrder: 0, status: 1, parentId: parentId || 0 }
  dialogVisible.value = true
}

const editCategory = (data) => {
  dialogTitle.value = '编辑分类'
  isEdit.value = true
  editId.value = data.id
  form.value = { categoryName: data.categoryName, sortOrder: data.sortOrder, status: data.status, parentId: data.parentId }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.categoryName) {
    MessagePlugin.warning('请输入分类名称')
    return
  }
  if (isEdit.value) {
    await api.put('/category/update?id=' + editId.value, form.value)
    MessagePlugin.success('编辑成功')
  } else {
    await api.post('/category/create', form.value)
    MessagePlugin.success('创建成功')
  }
  dialogVisible.value = false
  loadTree()
}

const deleteCategory = (data) => {
  const confirmDialog = DialogPlugin.confirm({
    header: '提示',
    body: `确定删除分类"${data.categoryName}"？子分类将同步删除。`,
    theme: 'warning',
    confirmBtn: '确定',
    cancelBtn: '取消',
    onConfirm: async () => {
      confirmDialog.hide()
      await api.delete('/category/delete', { params: { id: data.id } })
      MessagePlugin.success('删除成功')
      if (selectedCategoryId.value === data.id) {
        selectedCategoryId.value = null
      }
      loadTree()
    },
    onClose: () => confirmDialog.hide()
  })
}

const executeChain = async (chainCode) => {
  const res = await api.post('/execute/run', { chainCode })
  MessagePlugin.success('执行已启动: ' + res.data.executionId)
}

const onDictChainCommand = (cmd, row) => {
  if (cmd === 'execute') executeChain(row.chainCode)
}

const executeCategoryChains = async () => {
  if (!chains.value.length) return
  const chainCodes = chains.value.map(c => c.chainCode)
  const res = await api.post('/execute/batchRun', { chainCodes })
  const started = (res.data || []).filter(r => r.status === 'started').length
  MessagePlugin.success(`已启动 ${started} 条链路执行`)
}

onMounted(loadTree)
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.category-layout {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

.tree-panel {
  width: 320px;
  flex-shrink: 0;
  border: 1px solid var(--sb-border-strong);
  border-radius: 12px;
  padding: 16px;
}

.detail-panel {
  flex: 1;
}

.detail-panel.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chain-section {
  margin-top: 24px;
}

.chain-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chain-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
</style>
