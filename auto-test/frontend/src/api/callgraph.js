import api from './index'

/**
 * 系统调用关系图 API。
 * CallGraphVO: nodes[ {id,name,scope,category} ],
 *   edges[ {source,target,count} ],
 *   statsByModule / statsByScope / byDomain / detail
 */
export default {
  getData(chainCode) {
    return api.get('/call-graph/data', { params: { chainCode } })
  }
}
