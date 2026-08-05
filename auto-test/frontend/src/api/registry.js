import api from './index'

/**
 * 系统注册表 API（内外网识别）。
 * SysSystemRegistry: id, systemCode, systemName, scope(LOCAL|INTRANET|EXTERNAL|UNKNOWN),
 *   domainPatterns, ipRanges, category, description
 * ClassifyResult: scope, systemCode, systemName
 */
export default {
  list() {
    return api.get('/system-registry/list')
  },

  save(payload) {
    return api.post('/system-registry/save', payload)
  },

  remove(id) {
    return api.post('/system-registry/delete', { id })
  },

  // 识别某个 URL 的内外网归属
  classify(url) {
    return api.get('/system-registry/classify', { params: { url } })
  }
}
