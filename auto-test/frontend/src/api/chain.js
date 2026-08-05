import api from './index'

/**
 * 链路编排 API（260804 改版）。
 * 注意：axios 响应拦截器已把 response 转成 Result 对象 { code, data, message }，
 * 因此调用方应直接判断 res.code === 200 并使用 res.data，不要再解构一层 data。
 */
export default {
  // 链路详情（含 graphData 画布数据）
  getDetail(chainCode) {
    return api.get('/chain/detail', { params: { chainCode } })
  },

  // 保存画布（X6 graph.toJSON() 后的字符串）
  saveGraph(chainCode, graphData) {
    return api.post('/chain/graph/save', { chainCode, graphData })
  },

  // 预览分层执行计划（拓扑分层，用于校验 DAG + 展示执行顺序）
  previewLayers(chainCode) {
    return api.get('/chain/graph/layers', { params: { chainCode } })
  },

  // 链路列表
  list(params) {
    return api.get('/chain/list', { params })
  },

  create(payload) {
    return api.post('/chain/create', payload)
  },

  edit(payload) {
    return api.post('/chain/edit', payload)
  },

  remove(chainCode) {
    return api.post('/chain/delete', null, { params: { chainCode } })
  },

  copy(chainCode) {
    return api.post('/chain/copy', { chainCode })
  },

  batchDelete(chainCodes) {
    return api.post('/chain/batchDelete', { chainCodes })
  },

  // AI 生成测试数据
  generateTestData(chainCode) {
    return api.post('/ai/data/generate', { chainCode, idGenerateMode: 'AUTO_INCREMENT', idStep: 1 })
  },

  // 执行链路
  execute(chainCode) {
    return api.post('/execute/run', { chainCode })
  }
}
