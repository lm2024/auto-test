<template>
  <div class="category-tree-wrapper">
    <div class="tree-toolbar" v-if="mode === 'manage'">
      <t-input
        v-model="searchKeyword"
        placeholder="搜索分类..."
        clearable
        size="small"
        :prefix-icon="searchIcon"
        @change="filterTree"
      />
      <t-button size="small" theme="primary" variant="text" @click="$emit('addRoot')" style="margin-top:8px">
        新增根分类
      </t-button>
    </div>
    <t-tree
      ref="treeRef"
      :data="filteredTree"
      :keys="treeKeys"
      :expand-all="true"
      :activable="true"
      :value="modelArray"
      :expand-on-click-node="false"
      :hover="true"
      @click="handleNodeClick"
    >
      <template #label="{ node }">
        <span class="tree-node">
          <t-icon v-if="hasChildren(node)" name="folder" class="tree-folder-icon" />
          <t-icon v-else name="file" class="tree-file-icon" />
          <span class="node-label" :class="{ 'parent-node': hasChildren(node) }">{{ node.data.categoryName }}</span>
          <span class="node-actions" v-if="mode === 'manage'">
            <t-button variant="text" size="small" @click.stop="$emit('add-child', node.data)">+</t-button>
            <t-button variant="text" size="small" @click.stop="$emit('edit', node.data)">编辑</t-button>
            <t-button variant="text" size="small" theme="danger" @click.stop="$emit('delete', node.data)">删除</t-button>
          </span>
        </span>
      </template>
    </t-tree>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'CategoryTree',
  model: {
    prop: 'modelValue',
    event: 'update:modelValue'
  },
  props: {
    mode: { type: String, default: 'select' },
    multiple: { type: Boolean, default: false },
    modelValue: { type: [Number, String, Array], default: null }
  },
  data() {
    return {
      treeData: [],
      searchKeyword: '',
      treeKeys: { value: 'id', label: 'categoryName', children: 'children' },
      searchIcon: (h) => h('t-icon', { props: { name: 'search' } })
    }
  },
  computed: {
    filteredTree() {
      if (!this.searchKeyword) return this.treeData
      return this.filterTreeNodes(this.treeData, this.searchKeyword.toLowerCase())
    },
    modelArray() {
      if (this.multiple) {
        return Array.isArray(this.modelValue) ? this.modelValue : (this.modelValue ? [this.modelValue] : [])
      }
      return this.modelValue != null ? [this.modelValue] : []
    }
  },
  mounted() {
    this.loadTree()
  },
  watch: {
    modelValue(val) {
      // TDesign value 由 props 驱动，无需手动 setCheckedKeys
    }
  },
  methods: {
    hasChildren(node) {
      return !!(node && node.data && node.data.children && node.data.children.length)
    },
    filterTreeNodes(nodes, keyword) {
      return nodes.reduce((acc, node) => {
        const children = node.children ? this.filterTreeNodes(node.children, keyword) : []
        if (node.categoryName.toLowerCase().includes(keyword) || children.length > 0) {
          acc.push({ ...node, children })
        }
        return acc
      }, [])
    },
    async loadTree() {
      try {
        const res = await api.get('/category/tree')
        this.treeData = res.data || []
      } catch (e) {
        this.treeData = []
      }
    },
    handleNodeClick(ctx) {
      if (!ctx || !ctx.node) return
      const id = ctx.node.data.id
      if (this.multiple) {
        const current = Array.isArray(this.modelValue) ? this.modelValue.slice() : []
        const idx = current.indexOf(id)
        const next = idx >= 0 ? current.filter(function(x) { return x !== id }) : current.concat([id])
        this.$emit('update:modelValue', next)
      } else {
        this.$emit('update:modelValue', id)
      }
    },
    filterTree() {}
  }
}
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
  gap: 6px;
  flex: 1;
  padding-right: 8px;
}

.tree-folder-icon {
  color: var(--sb-green, #3ecf8e);
  font-size: 15px;
  flex-shrink: 0;
}

.tree-file-icon {
  color: var(--sb-text-mute, #8b8b8b);
  font-size: 15px;
  flex-shrink: 0;
}

.node-label {
  font-size: 14px;
}

.parent-node {
  font-weight: 600;
}

.node-actions {
  display: none;
  margin-left: auto;
}

.tree-node:hover .node-actions {
  display: inline-flex;
  gap: 4px;
}

::v-deep .t-tree__label {
  flex: 1;
  display: flex;
  align-items: center;
}
</style>
