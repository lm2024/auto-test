import api from './index'

/**
 * 全局 / 链路变量 API。
 * TestGlobalVariable: id, varScope(GLOBAL|CHAIN), chainCode, varName, varValue,
 *   varType, isEncrypted, description
 */
export default {
  list({ chainCode, scope } = {}) {
    return api.get('/variable/list', { params: { chainCode, scope } })
  },

  save(payload) {
    return api.post('/variable/save', payload)
  },

  remove(id) {
    return api.post('/variable/delete', { id })
  }
}
