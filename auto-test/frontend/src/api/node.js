import api from './index'

/**
 * 节点编排 API（260804 改版）。
 * 节点在画布上的唯一标识 = nodeCode（与后端 DagPlanner 的画布单元格 id 对齐）。
 */
export default {
  // 节点列表
  list(chainCode) {
    return api.get('/node/list', { params: { chainCode } })
  },

  // 创建节点
  create(payload) {
    return api.post('/node/create', payload)
  },

  // 编辑节点
  edit(payload) {
    return api.post('/node/edit', payload)
  },

  // 删除节点
  remove(id) {
    return api.post('/node/delete', null, { params: { id } })
  },

  // 批量导入接口（Swagger / cURL / JSON 等）
  importNodes(chainCode, interfaces) {
    return api.post('/node/import', { chainCode, interfaces })
  },

  // 单节点调试（不落库，直接发一次请求）
  debug(payload) {
    return api.post('/node/debug', payload)
  },

  // 节点依赖关系（用于自动补全连线建议，可选）
  getDependencies(chainCode) {
    return api.get('/node/dependencies', { params: { chainCode } })
  }
}
