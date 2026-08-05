<template>
  <div class="chain-edit">
    <!-- 顶部工具栏 -->
    <div class="ce-toolbar">
      <div class="tb-left">
        <t-button theme="default" variant="text" @click="goBack">
          <template #icon><ChevronLeftIcon /></template>返回
        </t-button>
        <span class="chain-name">{{ chainName }}</span>
        <t-tag size="small" theme="default" variant="light">{{ chainCode }}</t-tag>
      </div>
      <div class="tb-right">
        <t-button theme="primary" variant="outline" size="small" @click="addNode">
          <template #icon><AddIcon /></template>新增节点
        </t-button>
        <t-button theme="primary" variant="outline" size="small" @click="autoLayoutGraph">
          <template #icon><SwapIcon /></template>自动布局
        </t-button>
        <t-button theme="primary" variant="outline" size="small" :loading="saving" @click="saveGraphData">
          <template #icon><SaveIcon /></template>保存画布
        </t-button>
        <t-button theme="primary" variant="outline" size="small" @click="previewLayers">
          <template #icon><LayersIcon /></template>预览执行顺序
        </t-button>
        <t-button theme="primary" variant="outline" size="small" :loading="aiLoading" @click="generateData">
          <template #icon><LightbulbIcon /></template>AI 生成数据
        </t-button>
        <t-button theme="primary" variant="outline" size="small" @click="importVisible = true">
          <template #icon><DownloadIcon /></template>导入
        </t-button>
        <t-button theme="primary" variant="outline" size="small" @click="varVisible = true">
          <template #icon><RootListIcon /></template>变量
        </t-button>
        <t-button v-if="selectedNode" theme="primary" variant="outline" size="small" @click="openDebug">
          <template #icon><BugIcon /></template>调试
        </t-button>
        <t-button theme="primary" size="small" :loading="executing" @click="runChain">
          <template #icon><PlayCircleIcon /></template>执行
        </t-button>
      </div>
    </div>

    <!-- 画布区 -->
    <div class="ce-body">
      <!-- 左侧节点列表 -->
      <div class="ce-nodelist" :class="{ collapsed: listCollapsed }">
        <div class="nl-head">
          <span class="nl-title">节点列表 <em>({{ nodeList.length }})</em></span>
          <t-button theme="default" variant="text" size="small" @click="listCollapsed = !listCollapsed">
            <template #icon><ChevronLeftIcon v-if="!listCollapsed" /><ChevronRightIcon v-else /></template>
          </t-button>
        </div>
        <div v-show="!listCollapsed" class="nl-search">
          <t-input
            v-model="nodeSearch"
            placeholder="搜索节点名 / URL / 方法"
            size="small"
            clearable
          >
            <template #prefix-icon><SearchIcon /></template>
          </t-input>
        </div>
        <div v-show="!listCollapsed" class="nl-body">
          <div
            v-for="n in nodeList"
            :key="n.nodeCode"
            class="nl-item"
            :class="{ active: selectedNodeCode === n.nodeCode }"
            @click="selectFromList(n.nodeCode)"
          >
            <span class="nl-method" :class="'m-' + (n.requestMethod || 'GET').toLowerCase()">{{ n.requestMethod || 'GET' }}</span>
            <div class="nl-text">
              <div class="nl-name" :title="n.nodeName">{{ n.nodeName || '未命名节点' }}</div>
              <div class="nl-url" :title="displayUrl(n)">{{ displayUrl(n) }}</div>
            </div>
          </div>
          <div v-if="!nodeList.length" class="nl-empty">{{ nodeSearch ? '没有匹配的节点' : '暂无节点，点「新增节点」开始' }}</div>
        </div>
      </div>

      <div ref="canvasRef" class="ce-canvas"></div>

      <!-- 右侧属性面板 -->
      <transition name="slide-right">
        <div class="ce-side" :style="{ width: selectedNode ? '380px' : '0' }" v-show="selectedNode">
          <NodeConfigPanel
            :node="selectedNode"
            :chain-code="chainCode"
            @close="deselect"
            @save="onNodeSaved"
            @delete="onNodeDeleted"
            @debug="openDebug"
            @update:node="onNodeLiveChange"
          />
        </div>
      </transition>
    </div>

    <ImportDialog :visible="importVisible" :chain-code="chainCode" @close="importVisible = false" @imported="afterImport" />
    <GlobalVarPanel :visible="varVisible" :chain-code="chainCode" @close="varVisible = false" />
    <NodeDebugDrawer :visible="debugVisible" :node="selectedNode" :chain-code="chainCode" @close="debugVisible = false" />

    <t-dialog v-model:visible="layersVisible" header="分层执行顺序预览" width="520px" :footer="false">
      <div v-if="layers.length" class="layers-preview">
        <div v-for="(layer, i) in layers" :key="i" class="layer-row">
          <div class="layer-idx">第 {{ i + 1 }} 层</div>
          <div class="layer-nodes">
            <t-tag v-for="code in layer" :key="code" size="small" theme="primary" variant="light">
              {{ nodeName(code) }}
            </t-tag>
          </div>
        </div>
        <div class="layer-tip">共 {{ layers.length }} 层，同层节点可并发执行，层间串行。</div>
      </div>
      <t-empty v-else description="暂无可预览的执行顺序" />
    </t-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, provide, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  ChevronLeftIcon, ChevronRightIcon, AddIcon, SaveIcon, LightbulbIcon, DownloadIcon, RootListIcon,
  BugIcon, PlayCircleIcon, SwapIcon, LayersIcon, SearchIcon
} from 'tdesign-icons-vue-next'
import chainApi from '../api/chain'
import nodeApi from '../api/node'
import { createGraph, addHttpNode, autoLayout, NODE_SHAPE } from '../graph/graph'
import NodeConfigPanel from '../components/chain/NodeConfigPanel.vue'
import ImportDialog from '../components/chain/ImportDialog.vue'
import GlobalVarPanel from '../components/chain/GlobalVarPanel.vue'
import NodeDebugDrawer from '../components/chain/NodeDebugDrawer.vue'

const route = useRoute()
const router = useRouter()

const chainCode = route.params.chainCode
const chainName = ref(chainCode)
const canvasRef = ref(null)

let graph = null
const nodeDataMap = reactive({})
const selectedNodeCode = ref(null)
const selectedNode = ref(null)

const saving = ref(false)
const aiLoading = ref(false)
const executing = ref(false)
const importVisible = ref(false)
const varVisible = ref(false)
const debugVisible = ref(false)
const layersVisible = ref(false)
const layers = ref([])
const listCollapsed = ref(false)
const nodeSearch = ref('')

// 注：HttpNode 由 @antv/x6-vue-shape 挂在独立 Vue 上下文，收不到本组件的 provide；
// 选中态/数据均通过节点自身 data 传递（见 selectNode / HttpNode）。

function nodeName(code) {
  const n = nodeDataMap[code]
  return n ? n.nodeName || code : code
}

// 左侧节点列表：按 nodeId 稳定排序，并按 nodeSearch 过滤（节点名 / URL / 请求方法）
const nodeList = computed(() => {
  const all = Object.values(nodeDataMap).sort((a, b) => (a.nodeId || 0) - (b.nodeId || 0))
  const kw = nodeSearch.value.trim().toLowerCase()
  if (!kw) return all
  return all.filter((n) => {
    const name = (n.nodeName || '').toLowerCase()
    const url = (n.requestUrl || n.pageUrl || '').toLowerCase()
    const method = (n.requestMethod || '').toLowerCase()
    return name.includes(kw) || url.includes(kw) || method.includes(kw)
  })
})

// 节点 URL 显示：优先请求 URL，录制类节点回退页面 URL
function displayUrl(n) {
  if (!n) return '未配置 URL'
  return n.requestUrl || n.pageUrl || '未配置 URL'
}

// 从列表点击：选中节点并把画布居中到该节点
function selectFromList(code) {
  selectNode(code)
  centerOnNode(code)
}

function centerOnNode(code) {
  if (!graph) return
  const cell = graph.getCellById(code)
  if (!cell || !cell.isNode()) return
  try {
    if (typeof graph.centerCell === 'function') {
      graph.centerCell(cell)
      return
    }
  } catch (e) { /* fallthrough */ }
  // 兜底：手动平移使节点居中
  const bbox = cell.getBBox()
  const canvas = canvasRef.value
  if (canvas && bbox) {
    const tf = graph.getTransform()
    const zoom = tf.zoom || 1
    const dx = canvas.clientWidth / 2 - (bbox.x + bbox.width / 2) * zoom - tf.x
    const dy = canvas.clientHeight / 2 - (bbox.y + bbox.height / 2) * zoom - tf.y
    graph.translate(tf.x + dx, tf.y + dy)
  }
}

function toDisplay(n) {
  return {
    nodeCode: n.nodeCode, nodeName: n.nodeName, requestUrl: n.requestUrl, pageUrl: n.pageUrl,
    requestMethod: n.requestMethod, interfaceScope: n.interfaceScope, targetSystem: n.targetSystem
  }
}

async function load() {
  let detail = null
  try {
    detail = await chainApi.getDetail(chainCode)
    if (detail.code === 200 && detail.data) {
      chainName.value = detail.data.chainName || chainCode
    }
  } catch (e) { /* 详情失败不影响画布加载 */ }

  try {
    const listRes = await nodeApi.list(chainCode)
    if (listRes.code === 200) {
      const nodes = listRes.data || []
      nodes.forEach((n) => { nodeDataMap[n.nodeCode] = n })
      renderCanvas(detail?.data?.graphData)
    } else {
      MessagePlugin.error(listRes.message || '节点加载失败')
    }
  } catch (e) {
    MessagePlugin.error('节点加载失败: ' + (e.response?.data?.message || e.message))
  }
}

function renderCanvas(graphData) {
  if (!graph) return
  let parsed = null
  try {
    parsed = graphData ? JSON.parse(graphData) : null
  } catch {
    parsed = null
  }
  if (parsed && parsed.cells && parsed.cells.length) {
    // 画布 JSON(graph_data) 可能缺 requestUrl/pageUrl，用节点配置表补全后再渲染，
    // 避免画布节点显示“未配置 URL”（vue-shape 组件挂载后不会因 setData 自动刷新）
    parsed.cells.forEach((cell) => {
      if (cell && cell.shape === NODE_SHAPE && cell.data && nodeDataMap[cell.id]) {
        const d = nodeDataMap[cell.id]
        cell.data = {
          ...cell.data,
          nodeCode: d.nodeCode,
          nodeName: d.nodeName,
          requestUrl: d.requestUrl,
          pageUrl: d.pageUrl,
          requestMethod: d.requestMethod,
          interfaceScope: d.interfaceScope,
          targetSystem: d.targetSystem
        }
      }
    })
    graph.fromJSON(parsed)
  } else {
    // 无画布数据：按节点表平铺为无连线节点
    Object.values(nodeDataMap).forEach((n, i) => {
      addHttpNode(graph, n.nodeCode, toDisplay(n), { x: 80 + (i % 4) * 260, y: 80 + Math.floor(i / 4) * 110 })
    })
  }
}

function selectNode(code) {
  // 清除上一个选中节点的高亮标记
  if (selectedNodeCode.value && selectedNodeCode.value !== code && graph) {
    const prev = graph.getCellById(selectedNodeCode.value)
    if (prev && prev.isNode()) prev.setData({ ...prev.getData(), selected: false })
  }
  selectedNodeCode.value = code
  selectedNode.value = nodeDataMap[code] ? { ...nodeDataMap[code] } : null
  // 在 X6 节点自身 data 上落选中标记，HttpNode 通过 getNode + change:data 自行刷新高亮
  if (graph) {
    const cell = graph.getCellById(code)
    if (cell && cell.isNode()) cell.setData({ ...cell.getData(), selected: true })
  }
}
function deselect() {
  if (selectedNodeCode.value && graph) {
    const prev = graph.getCellById(selectedNodeCode.value)
    if (prev && prev.isNode()) prev.setData({ ...prev.getData(), selected: false })
  }
  selectedNodeCode.value = null
  selectedNode.value = null
}

async function addNode() {
  try {
    const res = await nodeApi.create({ chainCode, nodeName: '新节点', requestMethod: 'GET', requestUrl: 'http://' })
    if (res.code === 200) {
      const n = res.data
      nodeDataMap[n.nodeCode] = n
      addHttpNode(graph, n.nodeCode, toDisplay(n))
      selectNode(n.nodeCode)
      MessagePlugin.success('已新增节点')
    } else {
      MessagePlugin.error(res.message || '新增失败')
    }
  } catch (e) {
    MessagePlugin.error('新增失败: ' + (e.response?.data?.message || e.message))
  }
}

function onNodeSaved(payload) {
  if (payload && payload.nodeCode) {
    nodeDataMap[payload.nodeCode] = { ...nodeDataMap[payload.nodeCode], ...payload }
    const cell = graph.getCellById(payload.nodeCode)
    if (cell && cell.isNode()) cell.setData({ ...cell.getData(), ...toDisplay(nodeDataMap[payload.nodeCode]) })
  }
}

function onNodeLiveChange(payload) {
  if (!payload || !payload.nodeCode) return
  nodeDataMap[payload.nodeCode] = { ...nodeDataMap[payload.nodeCode], ...payload }
  const cell = graph.getCellById(payload.nodeCode)
  if (cell && cell.isNode()) cell.setData(toDisplay(nodeDataMap[payload.nodeCode]))
}

async function onNodeDeleted(id) {
  const code = selectedNodeCode.value
  try {
    const res = await nodeApi.remove(id)
    if (res.code === 200) {
      if (code && graph.getCellById(code)) graph.removeCell(code)
      delete nodeDataMap[code]
      deselect()
      MessagePlugin.success('已删除节点')
    } else {
      MessagePlugin.error(res.message || '删除失败')
    }
  } catch (e) {
    MessagePlugin.error('删除失败: ' + (e.response?.data?.message || e.message))
  }
}

function autoLayoutGraph() {
  autoLayout(graph)
  MessagePlugin.success('已自动布局')
}

async function saveGraphData() {
  if (!graph) return
  saving.value = true
  try {
    const data = JSON.stringify(graph.toJSON())
    const res = await chainApi.saveGraph(chainCode, data)
    if (res.code === 200) {
      const cnt = res.data?.layerCount || 0
      MessagePlugin.success(`画布已保存（${cnt} 层执行计划）`)
    } else {
      MessagePlugin.error(res.message || '保存失败')
    }
  } catch (e) {
    MessagePlugin.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally {
    saving.value = false
  }
}

async function previewLayers() {
  try {
    const res = await chainApi.previewLayers(chainCode)
    if (res.code === 200) {
      layers.value = res.data || []
      layersVisible.value = true
    } else {
      MessagePlugin.error(res.message || '预览失败')
    }
  } catch (e) {
    MessagePlugin.error('预览失败: ' + (e.response?.data?.message || e.message))
  }
}

async function generateData() {
  aiLoading.value = true
  try {
    const res = await chainApi.generateTestData(chainCode)
    if (res.code === 200) {
      const nodeData = res.data?.nodeData || {}
      let updated = 0
      Object.values(nodeDataMap).forEach((n) => {
        if (nodeData[n.nodeCode] && nodeData[n.nodeCode].bodyData) {
          nodeDataMap[n.nodeCode].bodyData = nodeData[n.nodeCode].bodyData
          updated++
        }
      })
      if (updated > 0) await saveAllNodes()
      MessagePlugin.success(`已生成并写入 ${updated} 个节点的测试数据`)
    } else {
      MessagePlugin.error(res.message || '生成失败')
    }
  } catch (e) {
    MessagePlugin.error('生成失败: ' + (e.response?.data?.message || e.message))
  } finally {
    aiLoading.value = false
  }
}

async function saveAllNodes() {
  for (const n of Object.values(nodeDataMap)) {
    if (n.id) await nodeApi.edit(n)
  }
}

async function runChain() {
  executing.value = true
  try {
    const res = await chainApi.execute(chainCode)
    if (res.code === 200) {
      const executionId = res.data?.executionId
      MessagePlugin.success('执行已启动')
      router.push('/execute/detail/' + executionId)
    } else {
      MessagePlugin.error(res.message || '执行失败')
    }
  } catch (e) {
    MessagePlugin.error('执行失败: ' + (e.response?.data?.message || e.message))
  } finally {
    executing.value = false
  }
}

function afterImport() {
  // 重新拉取节点并刷新画布
  Object.keys(nodeDataMap).forEach((k) => delete nodeDataMap[k])
  graph.clearCells()
  load()
}

function openDebug() {
  if (!selectedNode.value) return
  debugVisible.value = true
}

function goBack() {
  router.push('/chain/list')
}

onMounted(async () => {
  await nextTick()
  graph = createGraph(canvasRef.value)
  graph.on('node:click', ({ node }) => selectNode(node.id))
  graph.on('blank:click', () => deselect())
  await load()
})

onBeforeUnmount(() => {
  if (graph) graph.dispose()
})
</script>

<style scoped>
.chain-edit { height: calc(100vh - 60px); display: flex; flex-direction: column; background: var(--surface, #fff); color: var(--text, #2c3e50); }
.ce-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; gap: 12px;
  background: var(--primary-soft, #e6f4f1);
  border-bottom: 1px solid var(--accent-border, #b8ddd4);
}
.tb-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.chain-name { font-size: 15px; font-weight: 600; color: var(--text, #2c3e50); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tb-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ce-body { flex: 1 1 auto; display: flex; min-height: 0; position: relative; }

/* 左侧节点列表 */
.ce-nodelist {
  flex: 0 0 248px; display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--border, #e5e6eb); background: var(--surface, #fff);
  transition: flex-basis 0.2s ease;
}
.ce-nodelist.collapsed { flex-basis: 40px; }
.nl-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border, #e5e6eb);
}
.nl-title { font-size: 13px; font-weight: 600; color: var(--text, #1d2129); white-space: nowrap; }
.nl-title em { font-style: normal; color: var(--text-mute, #86909c); font-weight: 400; }
.ce-nodelist.collapsed .nl-title { display: none; }
.nl-search { padding: 8px; border-bottom: 1px solid var(--border, #e5e6eb); }
.nl-body { flex: 1 1 auto; overflow: auto; padding: 8px; }
.nl-item {
  display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px;
  border-radius: 8px; cursor: pointer; border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}
.nl-item:hover { background: var(--primary-soft, rgba(74, 158, 142, 0.08)); }
.nl-item.active {
  background: var(--primary-soft, rgba(74, 158, 142, 0.12));
  border-color: var(--primary, #4a9e8e);
  box-shadow: 0 0 0 2px rgba(74, 158, 142, 0.25);
}
.nl-method {
  flex: 0 0 auto; font-size: 10px; font-weight: 700; color: #fff;
  border-radius: 4px; padding: 1px 5px; line-height: 16px; margin-top: 1px;
}
.nl-method.m-get { background: #2ba471; }
.nl-method.m-post { background: #4a9e8e; }
.nl-method.m-put { background: #d97706; }
.nl-method.m-delete { background: #d54941; }
.nl-method.m-patch { background: #8a5cf6; }
.nl-text { flex: 1 1 auto; min-width: 0; }
.nl-name {
  font-size: 13px; color: var(--text, #1d2129); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nl-url {
  font-size: 11px; color: var(--text-secondary, #4e5969);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;
}
.nl-item.active .nl-url { color: var(--primary-dark, #3d8475); }
.nl-empty { padding: 20px 12px; font-size: 12px; color: var(--text-mute, #86909c); text-align: center; }

.ce-canvas { flex: 1 1 auto; min-width: 0; position: relative; cursor: grab; }
.ce-canvas:active { cursor: grabbing; }
.ce-side {
  flex: 0 0 auto; border-left: 1px solid var(--border, #e5e6eb); overflow: hidden;
  transition: width 0.2s ease; background: var(--surface, #fff);
}
.slide-right-enter-active, .slide-right-leave-active { transition: width 0.2s ease; }
.layers-preview { display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow: auto; }
.layer-row { display: flex; gap: 10px; align-items: flex-start; }
.layer-idx { flex: 0 0 60px; font-size: 13px; font-weight: 600; color: var(--text-secondary, #5a6c7d); padding-top: 2px; }
.layer-nodes { display: flex; flex-wrap: wrap; gap: 6px; }
.layer-tip { font-size: 12px; color: var(--text-mute, #8494a7); margin-top: 6px; }
</style>
