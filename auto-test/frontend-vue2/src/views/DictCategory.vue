<template>
  <div>
    <t-card>
      <template #title><div class="card-header">
        <span>分类管理</span>
      </div></template>

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
          <t-descriptions :title="selectedCategory ? selectedCategory.categoryName : '分类详情'" :column="1" bordered>
            <t-descriptions-item label="分类ID">{{ selectedCategory ? selectedCategory.id : '' }}</t-descriptions-item>
            <t-descriptions-item label="父分类ID">{{ selectedCategory && selectedCategory.parentId ? selectedCategory.parentId : '无 (根节点)' }}</t-descriptions-item>
            <t-descriptions-item label="排序号">{{ selectedCategory ? selectedCategory.sortOrder : '' }}</t-descriptions-item>
            <t-descriptions-item label="状态">
              <t-tag :theme="selectedCategory && selectedCategory.status === 1 ? 'success' : 'default'">
                {{ selectedCategory && selectedCategory.status === 1 ? '启用' : '禁用' }}
              </t-tag>
            </t-descriptions-item>
          </t-descriptions>

          <div class="chain-section">
            <div class="chain-header">
              <h4>该分类下的链路</h4>
              <t-button theme="primary" size="small" @click="executeCategoryChains" :disabled="!chains || !chains.length">
                执行全部
              </t-button>
            </div>
            <t-table :data="chains" :columns="dictChainColumns" row-key="chainCode" :bordered="true" :stripe="true" size="small" style="margin-top:10px" />
          </div>
        </div>

        <div class="detail-panel empty" v-else>
          <t-empty description="请选择左侧分类查看详情" />
        </div>
      </div>
    </t-card>

    <t-dialog :visible="dialogVisible" @update:visible="val => dialogVisible = val" :header="dialogTitle" :width="500">
      <t-form :data="form" label-width="100px">
        <t-form-item label="分类名称">
          <t-input v-model="form.categoryName" />
        </t-form-item>
        <t-form-item label="排序号">
          <t-input-number v-model="form.sortOrder" :min="0" />
        </t-form-item>
        <t-form-item label="状态">
          <t-switch v-model="form.status" :custom-value="[1, 0]" />
        </t-form-item>
      </t-form>
      <template #footer>
        <t-button @click="dialogVisible = false">取消</t-button>
        <t-button theme="primary" @click="submitForm">确定</t-button>
      </template>
    </t-dialog>
  </div>
</template>

<script>
import api from '../api'
import CategoryTree from '../components/CategoryTree.vue'
import ActionMenu from '../components/ActionMenu.vue'

export default {
  name: 'DictCategory',
  components: {
    CategoryTree,
    ActionMenu
  },
  data() {
    return {
      selectedCategoryId: null,
      selectedCategory: null,
      categoryDescendantsMap: {},
      chains: [],
      dictChainColumns: [
        { colKey: 'chainCode', title: '链路编码', width: 180 },
        { colKey: 'chainName', title: '链路名称', width: 200 },
        { colKey: 'nodeCount', title: '节点数', width: 80 },
        { colKey: 'op', title: '操作', width: 80, align: 'center', cell: (h, ctx) => h(ActionMenu, {
          props: { items: [{ label: '执行', command: 'execute' }] },
          on: { command: (cmd) => this.onDictChainCommand(cmd, ctx.row) }
        }) }
      ],
      dialogVisible: false,
      dialogTitle: '新增分类',
      isEdit: false,
      editId: null,
      form: {
        categoryName: '',
        sortOrder: 0,
        status: 1,
        parentId: 0
      }
    }
  },
  created() {
    this.loadCategoryTreeMap()
    this.loadTree()
  },
  watch: {
    selectedCategoryId: function(val) {
      this.loadCategoryDetail(val)
    }
  },
  methods: {
    async loadCategoryTreeMap() {
      try {
        const res = await api.get('/category/tree')
        const descendants = {}
        const self = this
        const collectDescendants = function(nodes, acc) {
          ;(nodes || []).forEach(function(n) {
            acc.push(n.id)
            if (n.children) collectDescendants(n.children, acc)
          })
        }
        ;(res.data || []).forEach(function(n) {
          const acc = []
          collectDescendants([n], acc)
          descendants[n.id] = acc
        })
        this.categoryDescendantsMap = descendants
      } catch (e) { this.categoryDescendantsMap = {} }
    },
    expandCategoryIds(id) {
      const sub = this.categoryDescendantsMap && this.categoryDescendantsMap[id]
      if (sub && sub.length) return sub
      return id != null ? [id] : []
    },
    loadTree() {
      if (this.$refs.categoryTreeRef && this.$refs.categoryTreeRef.loadTree) {
        this.$refs.categoryTreeRef.loadTree()
      }
    },
    async loadCategoryDetail(id) {
      if (!id) {
        this.selectedCategory = null
        this.chains = []
        return
      }
      try {
        const res = await api.get('/category/detail', { params: { id } })
        this.selectedCategory = res.data
      } catch (e) {
        this.selectedCategory = null
      }
      try {
        const ids = this.expandCategoryIds(id)
        const res = await api.get('/chain/list', { params: { categoryId: ids.join(','), pageNo: 1, pageSize: 100 } })
        this.chains = res.data && res.data.list ? res.data.list : []
      } catch (e) {
        this.chains = []
      }
    },
    showCreateDialog(parentId) {
      this.dialogTitle = parentId ? '新增子分类' : '新增根分类'
      this.isEdit = false
      this.editId = null
      this.form = {
        categoryName: '',
        sortOrder: 0,
        status: 1,
        parentId: parentId || 0
      }
      this.dialogVisible = true
    },
    editCategory(data) {
      this.dialogTitle = '编辑分类'
      this.isEdit = true
      this.editId = data.id
      this.form = {
        categoryName: data.categoryName,
        sortOrder: data.sortOrder,
        status: data.status,
        parentId: data.parentId
      }
      this.dialogVisible = true
    },
    async submitForm() {
      if (!this.form.categoryName) {
        this.$message.warning('请输入分类名称')
        return
      }
      if (this.isEdit) {
        await api.put('/category/update?id=' + this.editId, this.form)
        this.$message.success('编辑成功')
      } else {
        await api.post('/category/create', this.form)
        this.$message.success('创建成功')
      }
      this.dialogVisible = false
      this.loadTree()
    },
    deleteCategory(data) {
      const self = this
      this.$dialog.confirm({
        header: '提示',
        body: '确定删除分类"' + data.categoryName + '"？子分类将同步删除。',
        onConfirm: async function() {
          await api.delete('/category/delete', { params: { id: data.id } })
          self.$message.success('删除成功')
          if (self.selectedCategoryId === data.id) {
            self.selectedCategoryId = null
          }
          self.loadTree()
        }
      })
    },
    async executeChain(chainCode) {
      const res = await api.post('/execute/run', { chainCode })
      this.$message.success('执行已启动: ' + res.data.executionId)
    },
    onDictChainCommand(cmd, row) {
      if (cmd === 'execute') {
        this.executeChain(row.chainCode)
      }
    },
    async executeCategoryChains() {
      if (!this.chains || !this.chains.length) return
      const chainCodes = this.chains.map(function(c) { return c.chainCode })
      const res = await api.post('/execute/batchRun', { chainCodes })
      var started = (res.data || []).filter(function(r) { return r.status === 'started' }).length
      this.$message.success('已启动 ' + started + ' 条链路执行')
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
}

.category-layout {
  display: flex;
  gap: 24px;
  min-height: 500px;
}

.tree-panel {
  width: 320px;
  flex-shrink: 0;
  border: 1px solid #e4e7ed;
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
}
</style>
