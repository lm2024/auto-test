<template>
  <div>
    <el-card>
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
          <el-descriptions :title="selectedCategory?.categoryName || '分类详情'" :column="1" border>
            <el-descriptions-item label="分类ID">{{ selectedCategory?.id }}</el-descriptions-item>
            <el-descriptions-item label="父分类ID">{{ selectedCategory?.parentId || '无 (根节点)' }}</el-descriptions-item>
            <el-descriptions-item label="排序号">{{ selectedCategory?.sortOrder }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="selectedCategory?.status === 1 ? 'success' : 'info'">
                {{ selectedCategory?.status === 1 ? '启用' : '禁用' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="chain-section">
            <div class="chain-header">
              <h4>该分类下的链路</h4>
              <el-button type="primary" size="small" @click="executeCategoryChains" :disabled="!chains.length">
                执行全部
              </el-button>
            </div>
            <el-table :data="chains" border stripe size="small" style="margin-top:10px">
              <el-table-column prop="chainCode" label="链路编码" width="180" />
              <el-table-column prop="chainName" label="链路名称" width="200" />
              <el-table-column prop="nodeCount" label="节点数" width="80" />
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button size="small" type="success" @click="executeChain(row.chainCode)">执行</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <div class="detail-panel empty" v-else>
          <el-empty description="请选择左侧分类查看详情" />
        </div>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="分类名称">
          <el-input v-model="form.categoryName" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
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
import { ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'

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
    ElMessage.warning('请输入分类名称')
    return
  }
  if (isEdit.value) {
    await api.put('/category/update?id=' + editId.value, form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/category/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadTree()
}

const deleteCategory = async (data) => {
  await ElMessageBox.confirm(`确定删除分类"${data.categoryName}"？子分类将同步删除。`, '提示', { type: 'warning' })
  await api.delete('/category/delete', { params: { id: data.id } })
  ElMessage.success('删除成功')
  if (selectedCategoryId.value === data.id) {
    selectedCategoryId.value = null
  }
  loadTree()
}

const executeChain = async (chainCode) => {
  const res = await api.post('/execute/run', { chainCode })
  ElMessage.success('执行已启动: ' + res.data.executionId)
}

const executeCategoryChains = async () => {
  if (!chains.value.length) return
  const chainCodes = chains.value.map(c => c.chainCode)
  const res = await api.post('/execute/batchRun', { chainCodes })
  const started = (res.data || []).filter(r => r.status === 'started').length
  ElMessage.success(`已启动 ${started} 条链路执行`)
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
  color: #1e1b4b;
}

.category-layout {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

.tree-panel {
  width: 320px;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
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
  color: #1e1b4b;
}
</style>
