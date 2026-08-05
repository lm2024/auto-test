<template>
  <div class="http-node" :class="{ 'is-selected': selected }" @click="onClick">
    <div class="hn-head">
      <span class="hn-method" :class="'m-' + method.toLowerCase()">{{ method }}</span>
      <span class="hn-name" :title="name">{{ name }}</span>
      <span v-if="scope" class="hn-scope" :class="'s-' + scope.toLowerCase()">{{ scopeLabel }}</span>
    </div>
    <div class="hn-url" :class="{ 'hn-url-empty': urlEmpty }" :title="tooltip">
      <template v-if="urlEmpty">未配置 URL</template>
      <template v-else>
        <span v-if="urlIsPage" class="hn-url-tag">页</span>{{ displayUrl }}
      </template>
    </div>
    <div v-if="targetSystem" class="hn-target">→ {{ targetSystem }}</div>
  </div>
</template>

<script>
import { inject, computed, ref, onMounted, onBeforeUnmount } from 'vue'

const METHOD_COLORS = {
  get: '#2ba471',
  post: '#0052d9',
  put: '#d97706',
  delete: '#d54941',
  patch: '#8a5cf6'
}
const SCOPE_LABEL = {
  INTERNAL: '内网',
  EXTERNAL: '外网',
  UNKNOWN: '未知'
}
const SCOPE_CLASS = {
  INTERNAL: 's-internal',
  EXTERNAL: 's-external',
  UNKNOWN: 's-unknown'
}

export default {
  name: 'HttpNode',
  props: {
    // x6-vue-shape 会把当前节点实例作为 prop 传入
    node: { type: Object, required: true }
  },
  setup(props) {
    const nodeDataMap = inject('nodeDataMap', null)
    const getNode = inject('getNode', null)
    const node = (getNode && getNode()) || props.node

    const id = computed(() => props.node && props.node.id)
    const live = computed(() => {
      if (nodeDataMap && id.value && nodeDataMap[id.value]) return nodeDataMap[id.value]
      return props.node ? props.node.getData() || {} : {}
    })

    const method = computed(() => (live.value.requestMethod || 'GET').toUpperCase())
    const name = computed(() => live.value.nodeName || '未命名节点')
    const requestUrl = computed(() => live.value.requestUrl || '')
    const pageUrl = computed(() => live.value.pageUrl || '')
    // 优先请求 URL，录制类节点回退页面 URL（pageUrl）
    const displayUrl = computed(() => requestUrl.value || pageUrl.value || '')
    const urlIsPage = computed(() => !requestUrl.value && !!pageUrl.value)
    const urlEmpty = computed(() => !displayUrl.value)
    const scope = computed(() => live.value.interfaceScope || '')
    const targetSystem = computed(() => live.value.targetSystem || '')
    const scopeLabel = computed(() => SCOPE_LABEL[scope.value] || scope.value)

    const tooltip = computed(() => {
      if (urlEmpty.value) return '该节点尚未配置请求地址（requestUrl / pageUrl 均为空）'
      const parts = []
      if (requestUrl.value) parts.push('请求URL: ' + requestUrl.value)
      if (pageUrl.value) parts.push('页面URL: ' + pageUrl.value)
      return parts.join('\n')
    })

    // 选中高亮：X6 的 vue-shape 挂在独立 Vue 上下文，provide 的 selectedNodeCode 收不到，
    // 故直接读节点自身 data.selected，并监听 change:data 自行刷新（不依赖 X6 重渲染组件）
    const selected = ref(!!(node && node.getData() && node.getData().selected))
    const onDataChange = () => {
      if (node) selected.value = !!(node.getData() && node.getData().selected)
    }
    onMounted(() => { if (node) node.on('change:data', onDataChange) })
    onBeforeUnmount(() => { if (node) node.off('change:data', onDataChange) })

    const onClick = () => {
      if (props.node) props.node.emit('node-clicked', id.value)
    }

    return { method, name, displayUrl, urlIsPage, urlEmpty, scope, targetSystem, scopeLabel, selected, onClick, tooltip }
  }
}
</script>

<style scoped>
.http-node {
  width: 220px;
  height: 76px;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.http-node.is-selected {
  border-color: #4a9e8e;
  box-shadow: 0 0 0 3px rgba(74, 158, 142, 0.35), 0 4px 14px rgba(74, 158, 142, 0.25);
  animation: hn-pulse 1.4s ease-in-out infinite;
}
@keyframes hn-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(74, 158, 142, 0.35), 0 4px 14px rgba(74, 158, 142, 0.22); }
  50% { box-shadow: 0 0 0 5px rgba(74, 158, 142, 0.5), 0 6px 18px rgba(74, 158, 142, 0.35); }
}
.hn-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.hn-method {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #0052d9;
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 16px;
}
.hn-method.m-get { background: #2ba471; }
.hn-method.m-post { background: #0052d9; }
.hn-method.m-put { background: #d97706; }
.hn-method.m-delete { background: #d54941; }
.hn-method.m-patch { background: #8a5cf6; }
.hn-name {
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hn-scope {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  line-height: 15px;
}
.hn-scope.s-internal { background: #e8f3ff; color: #0052d9; }
.hn-scope.s-external { background: #fff1e9; color: #d54941; }
.hn-scope.s-unknown { background: #f2f3f5; color: #86909c; }
.hn-url {
  font-size: 11px;
  color: #4e5969;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hn-url-empty {
  color: #d97706;
  font-style: italic;
}
.hn-url-tag {
  flex: 0 0 auto;
  font-size: 9px;
  line-height: 14px;
  padding: 0 4px;
  border-radius: 3px;
  background: #e8f3ff;
  color: #4a9e8e;
  font-style: normal;
}
.hn-target {
  font-size: 10px;
  color: #86909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
