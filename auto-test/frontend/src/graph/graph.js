import { Graph } from '@antv/x6'
import { register } from '@antv/x6-vue-shape'
import HttpNode from '../components/x6/HttpNode.vue'

const NODE_WIDTH = 220
const NODE_HEIGHT = 76
const NODE_SHAPE = 'http-node'
const EDGE_SHAPE = 'dag-edge'

function rerouteEdges(graph, routerName = 'manhattan', routerArgs = { padding: 20 }) {
  graph.getEdges().forEach((edge) => {
    const sourceCell = edge.getSourceCellId()
    const targetCell = edge.getTargetCellId()
    if (sourceCell && targetCell) {
      const sourceNode = graph.getCellById(sourceCell)
      const targetNode = graph.getCellById(targetCell)
      const sourceCenter = sourceNode?.getBBox()?.getCenter()
      const targetCenter = targetNode?.getBBox()?.getCenter()
      let sourcePort = 'out'
      let targetPort = 'in'
      if (sourceCenter && targetCenter) {
        const dx = targetCenter.x - sourceCenter.x
        const dy = targetCenter.y - sourceCenter.y
        if (Math.abs(dx) >= Math.abs(dy)) {
          sourcePort = dx >= 0 ? 'out' : 'in'
          targetPort = dx >= 0 ? 'in' : 'out'
        } else {
          sourcePort = dy >= 0 ? 'bottom' : 'top'
          targetPort = dy >= 0 ? 'top' : 'bottom'
        }
      }
      edge.setSource({ cell: sourceCell, port: sourcePort })
      edge.setTarget({ cell: targetCell, port: targetPort })
    }
    // 布局只改变节点坐标，清掉旧布局留下的折返点，避免连线沿旧路径绕行。
    edge.setVertices([])
    edge.setRouter({ name: routerName, args: routerArgs })
    edge.setConnector({ name: 'rounded', args: { radius: 8 } })
    edge.attr('line/targetMarker', { name: 'classic', size: 8 })
  })
}

let edgeRegistered = false
let nodeRegistered = false

function ensureRegistered() {
  if (!edgeRegistered) {
    Graph.registerEdge(
      EDGE_SHAPE,
      {
        inherit: 'edge',
        attrs: {
          line: {
            stroke: '#7c8aa0',
            strokeWidth: 2,
            targetMarker: { name: 'classic', size: 8 }
          }
        }
      },
      true
    )
    edgeRegistered = true
  }
  if (!nodeRegistered) {
    register({
      shape: NODE_SHAPE,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      component: HttpNode,
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: { r: 5, magnet: true, stroke: '#5F95FF', strokeWidth: 1, fill: '#fff' }
            }
          },
          out: {
            position: 'right',
            attrs: {
              circle: { r: 5, magnet: true, stroke: '#5F95FF', strokeWidth: 1, fill: '#fff' }
            }
          },
          top: {
            position: 'top',
            attrs: {
              circle: { r: 4, magnet: true, stroke: 'transparent', fill: 'transparent' }
            }
          },
          bottom: {
            position: 'bottom',
            attrs: {
              circle: { r: 4, magnet: true, stroke: 'transparent', fill: 'transparent' }
            }
          }
        },
        items: [
          { id: 'in', group: 'in' },
          { id: 'out', group: 'out' },
          { id: 'top', group: 'top' },
          { id: 'bottom', group: 'bottom' }
        ]
      }
    })
    nodeRegistered = true
  }
}

/**
 * 创建一个编排画布实例。
 * @param {HTMLElement} container 挂载容器
 */
export function createGraph(container) {
  ensureRegistered()
  const graph = new Graph({
    container,
    autoResize: true,
    background: { color: '#f7f8fa' },
    grid: { visible: true, type: 'dot', size: 16, args: { color: '#dfe3e8', thickness: 1 } },
    panning: { enabled: true, eventTypes: ['leftMouseDown', 'spaceKey', 'mouseWheel'] },
    mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'], minScale: 0.4, maxScale: 2 },
    connecting: {
      router: { name: 'manhattan', args: { padding: 12 } },
      connector: { name: 'rounded', args: { radius: 8 } },
      snap: { radius: 20 },
      allowBlank: false,
      allowLoop: false,
      allowNode: false,
      allowEdge: false,
      allowMulti: false,
      createEdge() {
        return graph.createEdge({
          shape: EDGE_SHAPE,
          attrs: {
            line: { stroke: '#7c8aa0', strokeWidth: 2, targetMarker: { name: 'classic', size: 8 } }
          },
          zIndex: -1
        })
      },
      validateConnection({ sourceCell, targetCell }) {
        if (!sourceCell || !targetCell) return false
        if (sourceCell === targetCell) return false
        return true
      }
    },
    highlighting: {
      magnetAvailable: { name: 'stroke', args: { padding: 2, attrs: { stroke: '#5F95FF' } } }
    }
  })
  return graph
}

/**
 * 在画布上新增一个 HTTP 节点。
 * 节点 id 必须使用 nodeCode，与后端 DagPlanner 的画布单元格 id 对齐。
 */
export function addHttpNode(graph, nodeCode, data, position) {
  const pos = position || { x: 80 + Math.random() * 240, y: 80 + Math.random() * 200 }
  return graph.addNode({
    id: nodeCode,
    shape: NODE_SHAPE,
    x: pos.x,
    y: pos.y,
    data
  })
}

/**
 * 简单的从左到右分层布局（BFS 按入度分层）。
 * 无连线的节点按创建顺序纵向堆叠。
 */
export function autoLayout(graph) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return
  const codeOf = (n) => n.id
  const indeg = new Map()
  const adj = new Map()
  nodes.forEach((n) => {
    indeg.set(codeOf(n), 0)
    adj.set(codeOf(n), [])
  })
  graph.getEdges().forEach((e) => {
    const s = e.getSourceCellId()
    const t = e.getTargetCellId()
    if (s && t && indeg.has(t)) {
      adj.get(s).push(t)
      indeg.set(t, indeg.get(t) + 1)
    }
  })

  const layer = new Map()
  const queue = []
  nodes.forEach((n) => {
    if (indeg.get(codeOf(n)) === 0) {
      layer.set(codeOf(n), 0)
      queue.push(codeOf(n))
    }
  })
  while (queue.length) {
    const cur = queue.shift()
    adj.get(cur).forEach((nxt) => {
      indeg.set(nxt, indeg.get(nxt) - 1)
      if (indeg.get(nxt) === 0) {
        layer.set(nxt, layer.get(cur) + 1)
        queue.push(nxt)
      }
    })
  }
  // 兜底：孤立节点（有环或完全没连线）
  nodes.forEach((n) => {
    if (!layer.has(codeOf(n))) layer.set(codeOf(n), 0)
  })

  const byLayer = new Map()
  nodes.forEach((n) => {
    const l = layer.get(codeOf(n))
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(n)
  })

  const COL_GAP = 280
  const ROW_GAP = 100
  byLayer.forEach((list, l) => {
    list.forEach((n, i) => {
      n.position(l * COL_GAP + 60, i * ROW_GAP + 60)
    })
  })
}

/**
 * 线性链路的自适应蛇形布局。只修改节点坐标，不修改边和执行顺序。
 * @param {Graph} graph
 * @param {{availableWidth?: number, minColumns?: number, maxColumns?: number}} options
 */
export function snakeLayout(graph, options = {}) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return { columns: 0, rows: 0 }

  const availableWidth = Math.max(320, options.availableWidth || graph.container?.clientWidth || 1280)
  const minColumns = options.minColumns || 2
  const maxColumns = options.maxColumns || 6
  const nodeWidth = NODE_WIDTH
  const nodeHeight = NODE_HEIGHT
  const horizontalGap = 96
  const verticalGap = 96
  const padding = 60
  const columns = Math.max(
    minColumns,
    Math.min(maxColumns, Math.floor((availableWidth - padding * 2 + horizontalGap) / (nodeWidth + horizontalGap)))
  )
  const rows = Math.ceil(nodes.length / columns)

  nodes.forEach((node, index) => {
    const row = Math.floor(index / columns)
    const offset = index % columns
    const column = row % 2 === 0 ? offset : columns - 1 - offset
    node.position(
      padding + column * (nodeWidth + horizontalGap),
      padding + row * (nodeHeight + verticalGap)
    )
  })
  // 线性蛇形链路的节点不会互相遮挡，使用 normal 直连，避免 orth/manhattan 额外生成绕行折点。
  rerouteEdges(graph, 'normal')

  return { columns, rows }
}

/**
 * DAG 分层布局：层级保持从左到右，同层节点按屏幕宽度折行，避免单层节点无限纵向堆叠。
 */
export function dagWrapLayout(graph, options = {}) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return { layers: 0, columns: 0 }

  const availableWidth = Math.max(320, options.availableWidth || graph.container?.clientWidth || 1280)
  const availableHeight = Math.max(480, options.availableHeight || graph.container?.clientHeight || 720)
  const nodeWidth = NODE_WIDTH
  const nodeHeight = NODE_HEIGHT
  const horizontalGap = 36
  const verticalGap = 48
  const layerGap = 100
  const padding = 60
  const columns = Math.max(1, Math.min(6, Math.floor((availableWidth - padding * 2 + horizontalGap) / (nodeWidth + horizontalGap))))
  const rowsPerColumn = Math.max(4, Math.min(8, Math.floor((availableHeight - padding * 2 + verticalGap) / (nodeHeight + verticalGap))))
  const codeOf = (node) => node.id
  const indegree = new Map(nodes.map((node) => [codeOf(node), 0]))
  const adjacency = new Map(nodes.map((node) => [codeOf(node), []]))

  graph.getEdges().forEach((edge) => {
    const source = edge.getSourceCellId()
    const target = edge.getTargetCellId()
    if (source && target && indegree.has(source) && indegree.has(target)) {
      adjacency.get(source).push(target)
      indegree.set(target, indegree.get(target) + 1)
    }
  })

  const level = new Map()
  const queue = nodes.filter((node) => indegree.get(codeOf(node)) === 0).map(codeOf)
  queue.forEach((code) => level.set(code, 0))
  while (queue.length) {
    const current = queue.shift()
    adjacency.get(current).forEach((next) => {
      indegree.set(next, indegree.get(next) - 1)
      level.set(next, Math.max(level.get(next) || 0, (level.get(current) || 0) + 1))
      if (indegree.get(next) === 0) queue.push(next)
    })
  }
  nodes.forEach((node) => { if (!level.has(codeOf(node))) level.set(codeOf(node), 0) })

  const byLevel = new Map()
  nodes.forEach((node) => {
    const current = level.get(codeOf(node))
    if (!byLevel.has(current)) byLevel.set(current, [])
    byLevel.get(current).push(node)
  })

  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b)
  let layerX = padding
  let maxRows = 0
  sortedLevels.forEach((levelNo, levelIndex) => {
    const levelNodes = byLevel.get(levelNo)
    const levelColumns = Math.max(1, Math.ceil(levelNodes.length / rowsPerColumn))
    maxRows = Math.max(maxRows, Math.min(rowsPerColumn, levelNodes.length))
    levelNodes.forEach((node, index) => {
      const column = Math.floor(index / rowsPerColumn)
      const row = index % rowsPerColumn
      node.position(
        layerX + column * (nodeWidth + horizontalGap),
        padding + row * (nodeHeight + verticalGap)
      )
    })
    // 下一层只在当前层实际占用宽度之后开始，不再按整个画布列数放大层间距。
    layerX += levelColumns * (nodeWidth + horizontalGap) + layerGap
  })
  rerouteEdges(graph)

  return { layers: sortedLevels.length, columns, rows: maxRows }
}

export { NODE_SHAPE, EDGE_SHAPE, NODE_WIDTH, NODE_HEIGHT }
