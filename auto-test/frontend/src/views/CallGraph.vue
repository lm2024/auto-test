<template>
  <div class="call-graph-page">
    <div class="page-head">
      <div>
        <div class="page-title">系统调用关系图</div>
        <div class="page-desc">基于链路配置自动汇总接口间的调用关系与内外网分布</div>
      </div>
      <div class="head-ops">
        <t-select v-model="chainCode" placeholder="全部链路" clearable style="width:220px" @change="load">
          <t-option v-for="c in chains" :key="c.chainCode" :label="c.chainName" :value="c.chainCode" />
        </t-select>
        <t-button theme="default" variant="outline" :loading="loading" @click="load">
          <template #icon><RefreshIcon /></template>刷新
        </t-button>
      </div>
    </div>

    <div class="cg-body">
      <div class="cg-graph">
        <div ref="graphRef" class="graph-canvas"></div>
        <t-empty v-if="!graphData.nodes || graphData.nodes.length === 0" description="暂无调用关系数据" class="graph-empty" />
      </div>

      <div class="cg-side">
        <div class="stat-card">
          <div class="stat-title">接口内外网分布</div>
          <div ref="scopeRef" class="stat-chart"></div>
        </div>
        <div class="stat-card">
          <div class="stat-title">按域名统计</div>
          <div ref="domainRef" class="stat-chart"></div>
        </div>
      </div>
    </div>

    <div class="cg-detail" v-if="graphData.detail && graphData.detail.length">
      <div class="stat-title" style="margin-bottom:8px">调用明细</div>
      <t-table :data="graphData.detail" :columns="detailColumns" row-key="chainCode" size="small" max-height="300">
        <template #scope="{ row }">
          <t-tag size="small" variant="light" :theme="row.scope === 'EXTERNAL' ? 'warning' : (row.scope === 'INTERNAL' ? 'primary' : 'default')">
            {{ scopeLabel(row.scope) }}
          </t-tag>
        </template>
      </t-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next'
import * as echarts from 'echarts'
import { Graph } from '@antv/g6'
import callgraphApi from '../api/callgraph'
import chainApi from '../api/chain'

const chainCode = ref('')
const chains = ref([])
const loading = ref(false)
const graphRef = ref(null)
const scopeRef = ref(null)
const domainRef = ref(null)

const graphData = reactive({ nodes: [], edges: [], statsByScope: [], byDomain: [], detail: [] })

let g6 = null
let scopeChart = null
let domainChart = null

const detailColumns = [
  { colKey: 'chainName', title: '链路', width: 140, ellipsis: true },
  { colKey: 'targetSystem', title: '目标系统', width: 140, ellipsis: true },
  { colKey: 'method', title: '方法', width: 70 },
  { colKey: 'url', title: 'URL', ellipsis: true },
  { colKey: 'scope', title: '归属', width: 80 },
  { colKey: 'count', title: '次数', width: 70 }
]

const SCOPE_LABEL = { INTERNAL: '内网', EXTERNAL: '外网', UNKNOWN: '未知' }
function scopeLabel(s) { return SCOPE_LABEL[s] || s || '未知' }

function scopeColor(s) {
  if (s === 'EXTERNAL') return '#d54941'
  if (s === 'INTERNAL') return '#0052d9'
  return '#86909c'
}

async function loadChains() {
  try {
    const res = await chainApi.list({})
    if (res.code === 200) chains.value = res.data || []
  } catch (e) { /* 忽略 */ }
}

async function load() {
  loading.value = true
  try {
    const res = await callgraphApi.getData(chainCode.value || '')
    if (res.code === 200) {
      Object.assign(graphData, {
        nodes: res.data.nodes || [],
        edges: res.data.edges || [],
        statsByScope: res.data.statsByScope || [],
        byDomain: res.data.byDomain || [],
        detail: res.data.detail || []
      })
      renderGraph()
      renderCharts()
    } else {
      MessagePlugin.error(res.message || '加载失败')
    }
  } catch (e) {
    MessagePlugin.error('加载失败: ' + (e.response?.data?.message || e.message))
  } finally {
    loading.value = false
  }
}

function renderGraph() {
  if (!graphRef.value) return
  const nodes = (graphData.nodes || []).map((n) => ({
    id: n.id,
    data: { label: n.name, scope: n.scope, category: n.category },
    style: {
      fill: n.scope === 'EXTERNAL' ? '#fff1e9' : (n.scope === 'INTERNAL' ? '#e8f3ff' : '#f2f3f5'),
      stroke: scopeColor(n.scope),
      lineWidth: 1.5
    }
  }))
  const edges = (graphData.edges || []).map((e) => ({ source: e.source, target: e.target }))

  if (g6) {
    g6.destroy()
    g6 = null
  }
  g6 = new Graph({
    container: graphRef.value,
    autoResize: true,
    data: { nodes, edges },
    layout: { type: 'force', linkDistance: 140, preventOverlap: true, nodeSize: 40 },
    node: {
      // 颜色已在每个节点的 style 上按 scope 显式指定，这里不再用 palette，避免覆盖
      style: {
        labelText: (d) => d.data?.label || d.id,
        size: 40,
        labelFill: '#1d2129',
        labelFontSize: 12,
        labelPlacement: 'bottom'
      }
    },
    edge: { style: { endArrow: true, stroke: '#c9cdd4', lineWidth: 1.5 } },
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
  })
  g6.render()
}

function renderCharts() {
  if (!scopeRef.value || !domainRef.value) return
  if (!scopeChart) scopeChart = echarts.init(scopeRef.value)
  if (!domainChart) domainChart = echarts.init(domainRef.value)

  scopeChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: (graphData.statsByScope || []).map((s) => ({
          name: scopeLabel(s.scope),
          value: s.count,
          itemStyle: { color: scopeColor(s.scope) }
        }))
      }
    ]
  })

  domainChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: (graphData.byDomain || []).map((d) => ({ name: d.domain || '未归类', value: d.count }))
      }
    ]
  })
}

function resize() {
  if (scopeChart) scopeChart.resize()
  if (domainChart) domainChart.resize()
}

onMounted(async () => {
  await loadChains()
  await load()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  if (g6) g6.destroy()
  if (scopeChart) scopeChart.dispose()
  if (domainChart) domainChart.dispose()
})
</script>

<style scoped>
.call-graph-page { padding: 20px 24px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 16px; }
.page-title { font-size: 18px; font-weight: 600; color: #1d2129; }
.page-desc { font-size: 13px; color: #86909c; margin-top: 4px; }
.head-ops { display: flex; gap: 8px; align-items: center; }
.cg-body { display: flex; gap: 16px; }
.cg-graph { position: relative; flex: 1 1 60%; min-width: 0; height: 460px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fafbfc; }
.graph-canvas { width: 100%; height: 100%; }
.graph-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.cg-side { flex: 1 1 40%; min-width: 280px; display: flex; flex-direction: column; gap: 16px; }
.stat-card { border: 1px solid #e5e6eb; border-radius: 8px; padding: 12px; background: #fff; }
.stat-title { font-size: 14px; font-weight: 600; color: #1d2129; margin-bottom: 8px; }
.stat-chart { width: 100%; height: 200px; }
.cg-detail { margin-top: 16px; border: 1px solid #e5e6eb; border-radius: 8px; padding: 12px; }
</style>
