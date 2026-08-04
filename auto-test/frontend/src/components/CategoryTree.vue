<template>
  <div class="category-tree-wrapper">
    <div class="tree-toolbar" v-if="mode === 'manage'">
      <t-input
        v-model="searchKeyword"
        placeholder="搜索分类..."
        clearable
        size="small"
        @change="filterTree"
      >
        <template #prefix-icon><SearchIcon /></template>
      </t-input>
      <t-button size="small" theme="primary" @click="$emit('addRoot')" style="margin-top:8px">
        新增根分类
      </t-button>
    </div>
    <t-tree
      ref="treeRef"
      :data="filteredTree"
      :keys="treeKeys"
      :expand-all="true"
      :expand-on-click-node="false"
      :draggable="mode === 'manage'"
      :allow-drop="allowDrop"
      :checkable="mode === 'select' && multiple"
      :activable="!multiple"
      :actived="activedKeys"
      :value="checkedKeys"
      hover
      transition
      @drop="handleDrop"
      @active="handleNodeClick"
      @change="handleCheck"
    >
      <template #label="{ node }">
        <div class="tree-node">
          <span class="node-label">{{ node.data.categoryName }}</span>
          <span class="node-actions" v-if="mode === 'manage'">
            <t-button variant="text" theme="primary" size="small" @click.stop="$emit('add-child', node.data)">+</t-button>
            <t-button variant="text" theme="primary" size="small" @click.stop="$emit('edit', node.data)">编辑</t-button>
            <t-button variant="text" theme="danger" size="small" @click.stop="$emit('delete', node.data)">删除</t-button>
          </span>
        </div>
      </template>
    </t-tree>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { SearchIcon } from 'tdesign-icons-vue-next'
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

// t-tree 通过 keys 映射字段名（等价于 el-tree 的 node-key + props）
const treeKeys = { value: 'id', label: 'categoryName', children: 'children' }

// t-tree 无 setCheckedKeys / setCurrentKey 实例方法，改由受控数组驱动
const activedKeys = ref([])
const checkedKeys = ref([])

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

// t-tree @active 回调签名为 (value: Array, context)
const handleNodeClick = (value) => {
  activedKeys.value = value
  if (props.multiple) return
  const id = Array.isArray(value) ? value[0] : value
  if (id === undefined) return
  emit('update:modelValue', id)
}

// t-tree @change 回调签名为 (value: Array, context)，value 即选中项集合
const handleCheck = (value) => {
  checkedKeys.value = value
  emit('update:modelValue', value)
}

// t-tree allowDrop 接收单一 context 对象；dropPosition 为 0 表示放入节点内部
const allowDrop = ({ dragNode, dropNode, dropPosition }) => {
  if (dropPosition === 0) return true
  const dragParentId = dragNode.getParent()?.data?.id || 0
  const dropParentId = dropNode.getParent()?.data?.id || 0
  return dragParentId === dropParentId
}

// t-tree @drop 回调签名为 ({ e, dragNode, dropNode, dropPosition })
const handleDrop = async ({ dragNode }) => {
  const parentId = dragNode.getParent()?.data?.id || 0
  const siblings = dragNode.getSiblings() || []
  const sortData = siblings.map((node, index) => ({ id: node.data.id, sortOrder: index }))
  try {
    await api.put('/category/sort', { parentId, items: sortData })
    emit('refresh')
  } catch (e) {
    loadTree()
  }
}

const filterTree = () => {}

const applyModelValue = () => {
  const val = props.modelValue
  if (props.multiple) {
    checkedKeys.value = Array.isArray(val) ? [...val] : (val ? [val] : [])
  } else {
    activedKeys.value = (val === null || val === undefined || val === '') ? [] : [val]
  }
}

watch(() => props.modelValue, applyModelValue)

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

/* 节点行高（t-tree 用 __item::before 撑高） */
:deep(.t-tree .t-tree__item::before) {
  height: 36px;
}

:deep(.t-tree .t-tree__label) {
  border-radius: 6px;
}

/* 选中态 / 悬停态：沿用原有的青绿色调，通过 TDesign 变量注入 */
:deep(.t-tree) {
  --td-brand-color-light: rgba(62, 207, 142, 0.14);
  --td-bg-color-container-hover: rgba(62, 207, 142, 0.08);
}
</style>
