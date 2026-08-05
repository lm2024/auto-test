import { Graph } from '@antv/x6'
import { register } from '@antv/x6-vue-shape'
import HttpNode from '../components/x6/HttpNode.vue'

const NODE_WIDTH = 220
const NODE_HEIGHT = 76
const NODE_SHAPE = 'http-node'
const EDGE_SHAPE = 'dag-edge'

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
            targetMarker: { name: 'block', width: 10, height: 8 }
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
          }
        },
        items: [
          { id: 'in', group: 'in' },
          { id: 'out', group: 'out' }
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
            line: { stroke: '#7c8aa0', strokeWidth: 2, targetMarker: { name: 'block', width: 10, height: 8 } }
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

export { NODE_SHAPE, EDGE_SHAPE, NODE_WIDTH, NODE_HEIGHT }
