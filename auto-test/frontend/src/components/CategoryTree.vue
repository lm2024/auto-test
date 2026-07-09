<template>
  <div class="category-tree-wrapper">
    <div class="tree-toolbar" v-if="mode === 'manage'">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索分类..."
        clearable
        size="small"
        prefix-icon="Search"
        @input="filterTree"
      />
      <el-button size="small" type="primary" @click="$emit('addRoot')" style="margin-top:8px">
        新增根分类
      </el-button>
    </div>
    <el-tree
      ref="treeRef"
      :data="filteredTree"
      :props="treeProps"
      :node-key="'id'"
      :default-expand-all="true"
      :expand-on-click-node="false"
      :draggable="mode === 'manage'"
      :allow-drop="allowDrop"
      :show-checkbox="mode === 'select' && multiple"
      @node-drop="handleDrop"
      @current-change="handleNodeClick"
      @check="handleCheck"
      highlight-current
    >
      <template #default="{ node, data }">
        <div class="tree-node">
          <span class="node-label">{{ data.categoryName }}</span>
          <span class="node-actions" v-if="mode === 'manage'">
            <el-button link type="primary" size="small" @click.stop="$emit('add-child', data)">+</el-button>
            <el-button link type="primary" size="small" @click.stop="$emit('edit', data)">编辑</el-button>
            <el-button link type="danger" size="small" @click.stop="$emit('delete', data)">删除</el-button>
          </span>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import api from '../api'

const props = defineProps({
  mode: { type: String, default: 'select' },
  multiple: { type: Boolean, default: false },
  modelValue: { type: [Number, String, Array], default: null }
})

const emit = defineEmits(['update:modelValue', 'addRoot', 'addChild', 'edit', 'delete', 'execute', 'refresh'])

const treeRef = ref(null)
const treeData = ref([])
const searchKeyword = ref('')

const treeProps = { children: 'children', label: 'categoryName' }

const filteredTree = computed(() => {
  if (!searchKeyword.value) return treeData.value
  return filterTreeNodes(treeData.value, searchKeyword.value.toLowerCase())
})

function filterTreeNodes(nodes, keyword) {
  return nodes.reduce((acc, node) => {
    const children = node.children ? filterTreeNodes(node.children, keyword) : []
    if (node.categoryName.toLowerCase().includes(keyword) || children.length > 0) {
      acc.push({ ...node, children })
    }
    return acc
  }, [])
}

const loadTree = async () => {
  try {
    const res = await api.get('/category/tree')
    treeData.value = res.data || []
  } catch (e) {
    treeData.value = []
  }
}

const handleNodeClick = (data) => {
  if (props.multiple) return
  emit('update:modelValue', data.id)
}

const handleCheck = () => {
  if (!treeRef.value) return
  emit('update:modelValue', treeRef.value.getCheckedKeys())
}

const allowDrop = (draggingNode, dropNode, type) => {
  if (type === 'inner') return true
  return draggingNode.parent.id === dropNode.parent.id
}

const handleDrop = async (draggingNode, dropNode, dropType) => {
  const parentId = draggingNode.parent.id || 0
  const siblings = draggingNode.parent.childNodes
  const sortData = siblings.map((node, index) => ({ id: node.data.id, sortOrder: index }))
  try {
    await api.put('/category/sort', { parentId, items: sortData })
    emit('refresh')
  } catch (e) {
    loadTree()
  }
}

const filterTree = () => {}

watch(() => props.modelValue, (val) => {
  if (!treeRef.value) return
  if (props.multiple) {
    treeRef.value.setCheckedKeys(Array.isArray(val) ? val : (val ? [val] : []))
  } else if (val) {
    treeRef.value.setCurrentKey(val)
  }
})

const applyModelValue = () => {
  if (!treeRef.value) return
  const val = props.modelValue
  if (props.multiple) {
    treeRef.value.setCheckedKeys(Array.isArray(val) ? val : (val ? [val] : []))
  } else if (val) {
    treeRef.value.setCurrentKey(val)
  }
}

onMounted(async () => {
  await loadTree()
  applyModelValue()
})

defineExpose({ loadTree })
</script>

<style scoped>
.category-tree-wrapper {
  padding: 8px 0;
}

.tree-toolbar {
  margin-bottom: 8px;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  padding-right: 8px;
}

.node-label {
  font-size: 14px;
}

.node-actions {
  display: none;
  margin-left: 8px;
}

.tree-node:hover .node-actions {
  display: inline-flex;
  gap: 4px;
}

:deep(.el-tree-node__content) {
  height: 36px;
  border-radius: 6px;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: rgba(62, 207, 142, 0.14);
}

:deep(.el-tree-node__content:hover) {
  background: rgba(62, 207, 142, 0.08);
}
</style>
