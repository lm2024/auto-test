<template>
  <div class="call-graph-page">
    <PageHeader title="系统调用关系分析" description="从系统、链路、协议和网络边界多个维度检索调用资产；图形只展示受控样本，明细始终分页">
      <template #actions>
        <t-button variant="outline" :loading="loading" @click="load">
          <template #icon><RefreshIcon /></template>刷新
        </t-button>
      </template>
    </PageHeader>

    <section class="filter-panel">
      <div class="filter-main">
        <t-input v-model="filters.keyword" placeholder="搜索链路、系统、URL 或目标系统" clearable class="keyword-input" @enter="search" />
        <t-select v-model="filters.chainCode" placeholder="全部链路" clearable class="filter-select">
          <t-option v-for="chain in chains" :key="chain.chainCode" :label="chain.chainName" :value="chain.chainCode" />
        </t-select>
        <t-select v-model="filters.scope" placeholder="全部网络范围" clearable class="filter-select">
          <t-option label="内网" value="INTERNAL" />
          <t-option label="外网" value="EXTERNAL" />
          <t-option label="未知" value="UNKNOWN" />
        </t-select>
        <t-select v-model="filters.method" placeholder="全部方法" clearable class="method-select">
          <t-option v-for="method in methods" :key="method" :label="method" :value="method" />
        </t-select>
        <t-select v-model="filters.category" placeholder="全部系统分类" clearable class="filter-select">
          <t-option v-for="category in categories" :key="category" :label="category" :value="category" />
        </t-select>
        <t-button theme="primary" @click="search">检索</t-button>
        <t-button variant="outline" @click="resetFilters">重置</t-button>
      </div>
      <div class="filter-foot">
        <span class="result-hint">当前条件命中 {{ formatNumber(graphData.totalRows) }} 条调用记录</span>
        <label class="graph-limit">图形节点上限
          <t-select v-model="maxNodes" size="small" style="width:96px">
            <t-option :value="100" label="100" />
            <t-option :value="200" label="200" />
            <t-option :value="500" label="500" />
          </t-select>
        </label>
      </div>
    </section>

    <section class="metric-grid">
      <div class="metric-card"><span>调用记录</span><strong>{{ formatNumber(graphData.totalRows) }}</strong><small>当前筛选范围</small></div>
      <div class="metric-card"><span>目标系统</span><strong>{{ formatNumber(graphData.totalSystems) }}</strong><small>图形样本内聚合</small></div>
      <div class="metric-card"><span>外网调用</span><strong>{{ formatNumber(scopeCount('EXTERNAL')) }}</strong><small>{{ percent(scopeCount('EXTERNAL'), graphData.totalRows) }} 占比</small></div>
      <div class="metric-card"><span>图形状态</span><strong>{{ graphData.graphTruncated ? '受控' : '完整' }}</strong><small>{{ graphData.graphTruncated ? `仅绘制前 ${maxNodes} 个节点样本` : '当前范围可完整展示' }}</small></div>
    </section>

    <div class="view-tabs">
      <button v-for="item in views" :key="item.value" :class="{ active: activeView === item.value }" @click="activeView = item.value">{{ item.label }}</button>
    </div>

    <section v-if="activeView === 'network'" class="network-layout">
      <div class="panel graph-panel">
        <div class="panel-head"><div><h2>{{ graphModeLabel }}</h2><p>有向边表示链路顺序；点击节点或连线查看明细。图形只渲染受控样本，明细继续分页。</p></div><div class="graph-actions"><t-select v-model="viewMode" size="small" style="width:150px"><t-option v-for="item in graphModes" :key="item.value" :label="item.label" :value="item.value" /></t-select><t-select v-model="layoutMode" size="small" style="width:120px"><t-option v-for="item in layoutOptions" :key="item.value" :label="item.label" :value="item.value" /></t-select><span v-if="graphData.graphTruncated" class="warning-text">Top {{ maxNodes }}</span></div></div>
        <div v-if="graphData.relationNotice" class="relation-notice">{{ graphData.relationNotice }}</div>
        <div class="graph-wrap"><div ref="graphRef" class="graph-canvas"></div><t-empty v-if="!graphData.nodes.length" description="当前条件暂无调用关系" class="graph-empty" /></div>
      </div>
      <div class="side-stack">
        <div class="panel chart-panel"><div class="panel-head compact"><h2>网络边界</h2><span>调用记录</span></div><div ref="scopeRef" class="chart"></div></div>
        <div class="panel chart-panel"><div class="panel-head compact"><h2>HTTP 方法</h2><span>调用记录</span></div><div ref="methodRef" class="chart"></div></div>
      </div>
    </section>

    <section v-else class="analysis-grid">
      <div class="panel large-chart"><div class="panel-head"><div><h2>{{ activeView === 'system' ? '目标系统排行' : activeView === 'chain' ? '链路调用排行' : 'HTTP 方法分布' }}</h2><p>统计来自数据库聚合，不依赖前端加载全部节点</p></div></div><div ref="primaryRef" class="primary-chart"></div></div>
      <div class="panel chart-panel"><div class="panel-head compact"><h2>网络边界</h2><span>当前筛选</span></div><div ref="scopeAltRef" class="chart"></div></div>
    </section>

    <section class="panel detail-panel">
      <div class="panel-head"><div><h2>调用明细</h2><p>按页检索原始调用配置，避免一次性渲染十万条记录</p></div></div>
      <t-table :data="graphData.detail" :columns="detailColumns" row-key="chainCode" size="small" bordered stripe :loading="loading">
        <template #scope="{ row }"><t-tag size="small" variant="light" :theme="scopeTheme(row.scope)">{{ scopeLabel(row.scope) }}</t-tag></template>
      </t-table>
      <div class="detail-footer"><span>第 {{ graphData.pageNo }} 页</span><t-pagination :current="graphData.pageNo" :page-size="graphData.pageSize" :total="graphData.totalRows" :page-size-options="[20, 50, 100]" show-jumper @change="onPageChange" /></div>
    </section>

    <t-drawer v-model:visible="graphDrawerVisible" :header="selectedGraphItem?.type === 'edge' ? '调用关系详情' : '目标系统详情'" size="420px" :footer="false">
      <template v-if="selectedGraphItem?.type === 'node'">
        <div class="graph-detail-title"><span class="detail-dot" :style="{ background: scopeColor(selectedGraphItem.data.scope) }"></span><strong>{{ selectedGraphItem.data.name }}</strong></div>
        <t-descriptions :column="1" bordered size="small">
          <t-descriptions-item label="系统编码">{{ selectedGraphItem.data.id }}</t-descriptions-item>
          <t-descriptions-item label="节点类型">{{ selectedGraphItem.data.nodeType || 'SYSTEM' }}</t-descriptions-item>
          <t-descriptions-item label="关系来源">{{ selectedGraphItem.data.relationSource || 'OVERVIEW' }}</t-descriptions-item>
          <t-descriptions-item label="网络范围">{{ scopeLabel(selectedGraphItem.data.scope) }}</t-descriptions-item>
          <t-descriptions-item label="系统分类">{{ selectedGraphItem.data.category || '未分类' }}</t-descriptions-item>
          <t-descriptions-item label="调用次数">{{ selectedGraphItem.data.count || nodeCallCount(selectedGraphItem.data.id) }}</t-descriptions-item>
        </t-descriptions>
        <div class="drawer-actions"><t-button theme="primary" @click="inspectNode">查看相关明细</t-button><t-button variant="outline" @click="focusNode">聚焦节点</t-button></div>
      </template>
      <template v-else-if="selectedGraphItem?.type === 'edge'">
        <t-descriptions :column="1" bordered size="small">
          <t-descriptions-item label="来源">{{ selectedGraphItem.data.source }}</t-descriptions-item>
          <t-descriptions-item label="目标">{{ selectedGraphItem.data.target }}</t-descriptions-item>
          <t-descriptions-item label="关系类型">{{ selectedGraphItem.data.relationType || 'OVERVIEW' }}</t-descriptions-item>
          <t-descriptions-item label="所属链路">{{ selectedGraphItem.data.chainCode || '全部链路' }}</t-descriptions-item>
          <t-descriptions-item label="调用次数">{{ selectedGraphItem.data.count || 0 }}</t-descriptions-item>
        </t-descriptions>
        <div class="drawer-actions"><t-button theme="primary" @click="inspectEdge">查看调用明细</t-button></div>
      </template>
    </t-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next'
import * as echarts from 'echarts'
import { Graph } from '@antv/g6'
import PageHeader from '../components/PageHeader.vue'
import callgraphApi from '../api/callgraph'
import chainApi from '../api/chain'
import registryApi from '../api/registry'

const views = [{ value: 'network', label: '链路分析' }, { value: 'system', label: '系统排行' }, { value: 'chain', label: '链路排行' }, { value: 'method', label: '方法分布' }]
const graphModes = [{ value: 'CHAIN_FLOW', label: '链路流转（推荐）' }, { value: 'SYSTEM_FLOW', label: '系统流转' }, { value: 'TARGET_OVERVIEW', label: '目标系统概览' }]
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const activeView = ref('network')
const viewMode = ref('CHAIN_FLOW')
const maxNodes = ref(200)
const filters = reactive({ keyword: '', chainCode: '', scope: '', method: '', category: '' })
const chains = ref([])
const categories = ref([])
const loading = ref(false)
const graphRef = ref(null)
const scopeRef = ref(null)
const methodRef = ref(null)
const scopeAltRef = ref(null)
const primaryRef = ref(null)
const graphData = reactive({ nodes: [], edges: [], statsByModule: [], statsByScope: [], statsByMethod: [], statsByChain: [], byDomain: [], detail: [], totalRows: 0, totalSystems: 0, pageNo: 1, pageSize: 20, graphTruncated: false, relationNotice: '' })
const layoutMode = ref('dagre')
const layoutOptions = [{ value: 'dagre', label: '分层流程' }, { value: 'force', label: '力导向' }, { value: 'circular', label: '环形布局' }, { value: 'radial', label: '径向布局' }]
const graphModeLabel = computed(() => graphModes.find(item => item.value === viewMode.value)?.label || '调用链路')
const graphDrawerVisible = ref(false)
const selectedGraphItem = ref(null)
let g6 = null
let charts = []

const detailColumns = [
  { colKey: 'chainName', title: '链路', width: 170, ellipsis: true },
  { colKey: 'targetSystem', title: '目标系统', width: 150, ellipsis: true },
  { colKey: 'method', title: '方法', width: 80 },
  { colKey: 'url', title: '请求 URL', ellipsis: true },
  { colKey: 'scope', title: '网络范围', width: 90 },
  { colKey: 'count', title: '次数', width: 70 }
]
const SCOPE_LABEL = { INTERNAL: '内网', EXTERNAL: '外网', UNKNOWN: '未知' }
const THEME_FALLBACKS = {
  text: '#1d2129',
  textSecondary: '#4e5969',
  textMute: '#86909c',
  surface: '#ffffff',
  surface2: '#f8fafc',
  border: '#e5e6eb',
  borderStrong: '#b8c1cc',
  primary: '#0f766e',
  internal: '#2f7cf6',
  external: '#e98a35',
  unknown: '#9aa4b2',
  danger: '#d54941'
}
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}
function themeColors() {
  const dark = document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('t-theme-dark')
  return {
    text: cssVar('--text', THEME_FALLBACKS.text),
    textSecondary: cssVar('--text-secondary', THEME_FALLBACKS.textSecondary),
    textMute: cssVar('--text-mute', THEME_FALLBACKS.textMute),
    surface: cssVar('--surface', THEME_FALLBACKS.surface),
    surface2: cssVar('--surface-2', THEME_FALLBACKS.surface2),
    border: cssVar('--border-strong', THEME_FALLBACKS.border),
    borderStrong: cssVar('--border-strong', THEME_FALLBACKS.borderStrong),
    primary: cssVar('--primary', THEME_FALLBACKS.primary),
    internal: dark ? '#70a7ff' : THEME_FALLBACKS.internal,
    external: dark ? '#f2ad67' : THEME_FALLBACKS.external,
    unknown: cssVar('--text-mute', THEME_FALLBACKS.unknown),
    danger: cssVar('--danger', THEME_FALLBACKS.danger)
  }
}
function scopeLabel(scope) { return SCOPE_LABEL[scope] || scope || '未知' }
function scopeTheme(scope) { return scope === 'EXTERNAL' ? 'warning' : scope === 'INTERNAL' ? 'primary' : 'default' }
function scopeColor(scope) {
  const colors = themeColors()
  return { INTERNAL: colors.internal, EXTERNAL: colors.external, UNKNOWN: colors.unknown }[scope] || colors.unknown
}
function formatNumber(value) { return Number(value || 0).toLocaleString('zh-CN') }
function percent(value, total) { return total ? `${Math.round(value / total * 100)}%` : '0%' }
function scopeCount(scope) { return (graphData.statsByScope || []).find(item => item.scope === scope)?.count || 0 }

async function loadOptions() {
  try {
    const [chainRes, registryRes] = await Promise.all([chainApi.list({}), registryApi.list()])
    chains.value = chainRes.code === 200 ? (chainRes.data || []) : []
    const values = (registryRes.code === 200 ? registryRes.data || [] : []).map(item => item.category).filter(Boolean)
    categories.value = [...new Set(values)].sort()
  } catch (e) { MessagePlugin.warning('筛选项加载不完整') }
}

async function load() {
  loading.value = true
  try {
    const res = await callgraphApi.getData({ ...filters, pageNo: graphData.pageNo, pageSize: graphData.pageSize, maxNodes: maxNodes.value, viewMode: viewMode.value })
    if (res.code !== 200) throw new Error(res.message || '加载失败')
    Object.assign(graphData, res.data || {})
    await nextTick()
    renderGraph()
    renderCharts()
  } catch (e) { MessagePlugin.error(e.response?.data?.message || e.message || '加载失败') } finally { loading.value = false }
}
function search() { graphData.pageNo = 1; load() }
function resetFilters() { Object.assign(filters, { keyword: '', chainCode: '', scope: '', method: '', category: '' }); search() }
function onPageChange(info) { graphData.pageNo = info.current; graphData.pageSize = info.pageSize; load() }

function renderGraph() {
  if (!graphRef.value) return
  if (g6) g6.destroy()
  const colors = themeColors()
  const nodes = graphData.nodes.map(node => ({ id: node.id, data: node, style: { labelText: node.name, labelFill: colors.text, labelFontSize: node.nodeType === 'INTERFACE' ? 11 : 12, fill: node.nodeType === 'CHAIN' ? colors.primary : colors.surface, stroke: node.nodeType === 'CHAIN' ? colors.primary : scopeColor(node.scope), lineWidth: 2, size: node.nodeType === 'CHAIN' ? 52 : node.nodeType === 'INTERFACE' ? 44 : 42 } }))
  const edges = graphData.edges.map(edge => ({ id: `edge-${edge.source}-${edge.target}`, source: edge.source, target: edge.target, data: edge, style: { endArrow: true, stroke: edge.relationType === 'INFERRED' ? colors.external : colors.borderStrong, lineDash: edge.relationType === 'INFERRED' ? [6, 4] : undefined, lineWidth: Math.max(1, Math.min(5, (edge.count || 1) / 5)) } }))
  const layouts = {
    force: { type: 'force', linkDistance: 130, preventOverlap: true, nodeSize: 44 },
    circular: { type: 'circular', radius: 190 },
    radial: { type: 'radial', unitRadius: 120, preventOverlap: true },
    dagre: { type: 'dagre', rankdir: 'LR', nodesep: 32, ranksep: 90 }
  }
  g6 = new Graph({ container: graphRef.value, autoResize: true, data: { nodes, edges }, layout: layouts[layoutMode.value], node: { type: 'circle' }, edge: { type: 'line' }, behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'] })
  g6.on('node:click', event => {
    const id = event?.target?.id || event?.id
    const node = graphData.nodes.find(item => item.id === id)
    if (node) { selectedGraphItem.value = { type: 'node', data: node }; graphDrawerVisible.value = true }
  })
  g6.on('edge:click', event => {
    const id = event?.target?.id || event?.id
    const edge = graphData.edges.find(item => `edge-${item.source}-${item.target}` === id)
    if (edge) { selectedGraphItem.value = { type: 'edge', data: edge }; graphDrawerVisible.value = true }
  })
  g6.render()
}
function nodeCallCount(id) {
  const edge = graphData.edges.find(item => item.target === id)
  return edge?.count || 0
}
function inspectNode() {
  const node = selectedGraphItem.value?.data
  if (!node || node.scope === 'SUT') return
  filters.keyword = node.name || node.id
  graphDrawerVisible.value = false
  search()
}
function inspectEdge() {
  const edge = selectedGraphItem.value?.data
  if (!edge) return
  const target = graphData.nodes.find(item => item.id === edge.target)
  filters.keyword = target?.name || edge.target
  graphDrawerVisible.value = false
  search()
}
function focusNode() {
  const node = selectedGraphItem.value?.data
  if (g6 && node?.id) {
    g6.focusElement(node.id, true)
  }
}
function chartBase() {
  const colors = themeColors()
  return {
    animation: false,
    textStyle: { color: colors.textSecondary },
    tooltip: { trigger: 'axis', backgroundColor: colors.surface, borderColor: colors.border, textStyle: { color: colors.text } },
    grid: { left: 48, right: 20, top: 20, bottom: 32, containLabel: true },
    xAxis: { axisLine: { lineStyle: { color: colors.border } }, axisLabel: { color: colors.textMute }, splitLine: { lineStyle: { color: colors.border } } },
    yAxis: { axisLine: { lineStyle: { color: colors.border } }, axisLabel: { color: colors.textMute }, splitLine: { lineStyle: { color: colors.border } } }
  }
}
function renderCharts() {
  charts.forEach(chart => chart.dispose()); charts = []
  const colors = themeColors()
  const pieRefs = [scopeRef.value, scopeAltRef.value].filter(Boolean)
  pieRefs.forEach(el => { const chart = echarts.init(el); chart.setOption({ animation: false, textStyle: { color: colors.textSecondary }, tooltip: { trigger: 'item', backgroundColor: colors.surface, borderColor: colors.border, textStyle: { color: colors.text } }, series: [{ type: 'pie', radius: ['42%', '68%'], label: { color: colors.textSecondary }, data: graphData.statsByScope.map(item => ({ name: scopeLabel(item.scope), value: item.count, itemStyle: { color: scopeColor(item.scope) } })) }] }); charts.push(chart) })
  if (methodRef.value) { const chart = echarts.init(methodRef.value); chart.setOption({ ...chartBase(), xAxis: { type: 'category', data: graphData.statsByMethod.map(item => item.name) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: graphData.statsByMethod.map(item => item.count), itemStyle: { color: colors.primary }, barMaxWidth: 28 }] }); charts.push(chart) }
  if (primaryRef.value) {
    const source = activeView.value === 'system' ? graphData.statsByModule : activeView.value === 'chain' ? graphData.statsByChain : graphData.statsByMethod
    const chart = echarts.init(primaryRef.value); chart.setOption({ ...chartBase(), tooltip: { trigger: 'axis', backgroundColor: colors.surface, borderColor: colors.border, textStyle: { color: colors.text } }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: source.slice(0, 30).map(item => item.name).reverse(), axisLabel: { width: 150, overflow: 'truncate' } }, series: [{ type: 'bar', data: source.slice(0, 30).map(item => item.count).reverse(), itemStyle: { color: colors.internal }, barMaxWidth: 20 }] }); charts.push(chart)
  }
}
function resize() { charts.forEach(chart => chart.resize()) }
function refreshTheme() { nextTick(() => { renderGraph(); renderCharts() }) }
let themeObserver = null
watch(activeView, () => nextTick(() => { if (activeView.value === 'network') renderGraph(); renderCharts() }))
watch(viewMode, () => { if (activeView.value === 'network') { graphData.pageNo = 1; load() } })
watch(layoutMode, () => nextTick(renderGraph))
watch(maxNodes, load)
onMounted(async () => { await loadOptions(); await load(); window.addEventListener('resize', resize); themeObserver = new MutationObserver(refreshTheme); themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); themeObserver?.disconnect(); if (g6) g6.destroy(); charts.forEach(chart => chart.dispose()) })
</script>

<style scoped>
.call-graph-page { padding: 20px 24px 32px; }
.filter-panel, .panel { border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); }
.filter-panel { margin-top: 18px; padding: 16px; }
.filter-main { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.keyword-input { width: min(360px, 100%); }
.filter-select { width: 150px; }
.method-select { width: 120px; }
.filter-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; color: var(--text-mute); font-size: 12px; }
.graph-limit { display: flex; align-items: center; gap: 8px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.metric-card { padding: 16px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); }
.metric-card span, .metric-card small { display: block; color: var(--text-mute); font-size: 12px; }
.metric-card strong { display: block; margin: 8px 0 4px; color: var(--text); font-size: 24px; line-height: 30px; }
.view-tabs { display: flex; gap: 4px; margin: 20px 0 12px; border-bottom: 1px solid var(--border-strong); }
.view-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; padding: 10px 14px; color: var(--text-secondary); cursor: pointer; }
.view-tabs button.active { border-bottom-color: var(--primary); color: var(--primary); font-weight: 600; }
.network-layout, .analysis-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, .8fr); gap: 16px; }
.analysis-grid { grid-template-columns: minmax(0, 1fr) 360px; }
.side-stack { display: grid; gap: 16px; }
.panel { padding: 16px; min-width: 0; }
.panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
.panel-head.compact { align-items: center; }
.panel-head h2 { margin: 0; color: var(--text); font-size: 15px; }
.panel-head p, .panel-head span { margin: 4px 0 0; color: var(--text-mute); font-size: 12px; }
.warning-text { color: var(--danger) !important; white-space: nowrap; }
.graph-wrap { position: relative; height: 520px; border-radius: 6px; background: var(--surface-2); }
.relation-notice { margin: -2px 0 10px; padding: 8px 10px; border-left: 3px solid var(--primary); background: var(--surface-2); color: var(--text-secondary); font-size: 12px; line-height: 18px; }
.graph-actions { display:flex; align-items:center; gap:10px; }
.graph-canvas { width: 100%; height: 100%; }
.graph-empty { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }
.chart { width: 100%; height: 190px; }
.primary-chart { width: 100%; height: 520px; }
.detail-panel { margin-top: 16px; }
.detail-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; color: var(--text-mute); font-size: 12px; }
.graph-detail-title { display:flex; align-items:center; gap:10px; font-size:18px; margin-bottom:16px; }.detail-dot { width:10px; height:10px; border-radius:50%; }.drawer-actions { display:flex; gap:10px; margin-top:18px; }
@media (max-width: 1000px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } .network-layout, .analysis-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .call-graph-page { padding: 14px; } .metric-grid { grid-template-columns: 1fr 1fr; } .filter-foot { align-items: flex-start; flex-direction: column; gap: 10px; } .filter-select, .method-select { flex: 1 1 140px; } .graph-wrap, .primary-chart { height: 420px; } }
</style>
