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

    <el-dialog :visible.sync="dialogVisible" :title="dialogTitle" width="500px">
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

<script>
import { Message, MessageBox } from 'element-ui'
import api from '../api'

export default {
  name: 'DictCategory',
  data() {
    return {
      categories: [],
      filter: { categoryType: '' },
      pageNo: 1,
      pageSize: 10,
      total: 0,
      dialogVisible: false,
      dialogTitle: '新增分类',
      isEdit: false,
      editId: null,
      form: { categoryType: 'system', categoryCode: '', categoryName: '', sortOrder: 0 }
    }
  },
  mounted() {
    this.loadCategories()
  },
  methods: {
    async loadCategories() {
      const params = { pageNo: this.pageNo, pageSize: this.pageSize }
      if (this.filter.categoryType) params.type = this.filter.categoryType
      const res = await api.get('/dict/category/list', { params })
      this.categories = (res.data && res.data.list) || []
      this.total = (res.data && res.data.total) || 0
    },
    onPageSizeChange(val) { this.pageSize = val; this.loadCategories() },
    onPageChange(val) { this.pageNo = val; this.loadCategories() },
    resetFilter() {
      this.filter = { categoryType: '' }
      this.pageNo = 1
      this.loadCategories()
    },
    showCreateDialog() {
      this.dialogTitle = '新增分类'
      this.isEdit = false
      this.editId = null
      this.form = { categoryType: 'system', categoryCode: '', categoryName: '', sortOrder: 0 }
      this.dialogVisible = true
    },
    editCategory(row) {
      this.dialogTitle = '编辑分类'
      this.isEdit = true
      this.editId = row.id
      this.form = { categoryType: row.categoryType, categoryCode: row.categoryCode, categoryName: row.categoryName, sortOrder: row.sortOrder }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.categoryCode || !this.form.categoryName) {
        Message.warning('请填写必填字段')
        return
      }
      if (this.isEdit) {
        await api.put('/dict/category/update?id=' + this.editId, this.form)
        Message.success('编辑成功')
      } else {
        await api.post('/dict/category/create', this.form)
        Message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadCategories()
    },
    async deleteCategory(id) {
      await MessageBox.confirm('确定删除该分类？', '提示', { type: 'warning' })
      await api.delete('/dict/category/delete', { params: { id } })
      Message.success('删除成功')
      this.loadCategories()
    }
  }
}
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
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 0;
}
</style>
