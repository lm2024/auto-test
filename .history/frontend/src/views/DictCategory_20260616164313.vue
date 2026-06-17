<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分类字典管理</span>
          <el-button type="primary" @click="showCreateDialog">新增分类</el-button>
        </div>
      </template>

      <div class="filter-bar">
        <el-select v-model="filter.categoryType" placeholder="分类类型" clearable style="width:200px">
          <el-option label="系统分类(system)" value="system" />
          <el-option label="功能分类(func)" value="func" />
        </el-select>
        <el-button type="primary" style="margin-left:10px" @click="loadCategories">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
      </div>

      <el-table :data="categories" border stripe style="margin-top:15px">
        <el-table-column prop="categoryType" label="分类类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.categoryType === 'system' ? '' : 'success'">
              {{ row.categoryType === 'system' ? '系统分类' : '功能分类' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="categoryCode" label="分类编码" width="180" />
        <el-table-column prop="categoryName" label="分类名称" width="180" />
        <el-table-column prop="sortOrder" label="排序号" width="100" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editCategory(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteCategory(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="分类类型">
          <el-select v-model="form.categoryType" :disabled="isEdit">
            <el-option label="系统分类" value="system" />
            <el-option label="功能分类" value="func" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类编码">
          <el-input v-model="form.categoryCode" :disabled="isEdit" placeholder="如 login_auth" />
        </el-form-item>
        <el-form-item label="分类名称">
          <el-input v-model="form.categoryName" placeholder="如 登录认证" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="form.sortOrder" :min="0" />
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
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

const categories = ref([])
const filter = ref({ categoryType: '' })
const dialogVisible = ref(false)
const dialogTitle = ref('新增分类')
const isEdit = ref(false)
const editId = ref(null)
const form = ref({ categoryType: 'system', categoryCode: '', categoryName: '', sortOrder: 0 })

const loadCategories = async () => {
  const params = {}
  if (filter.value.categoryType) params.type = filter.value.categoryType
  const res = await api.get('/dict/category/list', { params })
  categories.value = res.data || []
}

const resetFilter = () => {
  filter.value = { categoryType: '' }
  loadCategories()
}

const showCreateDialog = () => {
  dialogTitle.value = '新增分类'
  isEdit.value = false
  editId.value = null
  form.value = { categoryType: 'system', categoryCode: '', categoryName: '', sortOrder: 0 }
  dialogVisible.value = true
}

const editCategory = (row) => {
  dialogTitle.value = '编辑分类'
  isEdit.value = true
  editId.value = row.id
  form.value = { categoryType: row.categoryType, categoryCode: row.categoryCode, categoryName: row.categoryName, sortOrder: row.sortOrder }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!form.value.categoryCode || !form.value.categoryName) {
    ElMessage.warning('请填写必填字段')
    return
  }
  if (isEdit.value) {
    await api.put('/dict/category/update?id=' + editId.value, form.value)
    ElMessage.success('编辑成功')
  } else {
    await api.post('/dict/category/create', form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadCategories()
}

const deleteCategory = async (id) => {
  await ElMessageBox.confirm('确定删除该分类？', '提示', { type: 'warning' })
  await api.delete('/dict/category/delete', { params: { id } })
  ElMessage.success('删除成功')
  loadCategories()
}

onMounted(loadCategories)
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
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  flex-wrap: wrap;
}
</style>