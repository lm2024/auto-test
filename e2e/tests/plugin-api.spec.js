// plugin-api.spec.js —— 插件相关接口集成测试（按需求：插件功能只测接口）
// 直接用 Playwright 的 request fixture 发 HTTP，不走浏览器，验证后端接口可用。
import { test, expect, request } from '@playwright/test'
import { apiLogin, BASE_API } from '../helpers.js'

test.describe('插件接口集成', () => {
  let api

  // 用模块级 request（来自 @playwright/test）创建带 token 的请求上下文
  test.beforeEach(async () => {
    const token = await apiLogin()
    api = await request.newContext({
      baseURL: BASE_API,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    })
  })

  test('插件配置接口', async () => {
    const res = await api.get('/api/plugin/config')
    const body = await res.json()
    expect(body.code).toBe(200)
    expect(Array.isArray(body.data?.methods)).toBeTruthy()
  })

  test('插件链路列表接口', async () => {
    const res = await api.get('/api/plugin/chain/list', { params: { pageNum: 1, pageSize: 10 } })
    const body = await res.json()
    expect(body.code).toBe(200)
    expect(body.data).toHaveProperty('list')
    expect(body.data).toHaveProperty('total')
  })

  test('插件创建链路（核心接口）', async () => {
    const res = await api.post('/api/plugin/chain/create', {
      data: {
        chainName: '插件E2E_' + Date.now(),
        interfaceList: [
          { nodeName: 'login', method: 'POST', url: 'https://example.com/login', sort: 1 },
        ],
      },
    })
    const body = await res.json()
    expect(body.code).toBe(200)
    expect(body.data?.chainCode).toBeTruthy()
  })

  test('插件创建 -> 详情 -> 追加 -> 回放 全链路', async () => {
    // 1) 创建
    const create = await api.post('/api/plugin/chain/create', {
      data: {
        chainName: '插件链路_' + Date.now(),
        interfaceList: [
          { nodeName: 'n1', method: 'GET', url: 'https://example.com/a', sort: 1 },
        ],
      },
    })
    const chainCode = (await create.json()).data.chainCode

    // 2) 详情
    const detail = await api.get('/api/plugin/chain/detail', { params: { chainCode } })
    expect((await detail.json()).code).toBe(200)

    // 3) 追加节点
    const append = await api.post('/api/plugin/chain/append', {
      data: {
        chainCode,
        interfaceList: [
          { nodeName: 'n2', method: 'POST', url: 'https://example.com/b', sort: 2 },
        ],
      },
    })
    const appendBody = await append.json()
    expect(appendBody.code).toBe(200)
    expect(appendBody.data?.totalNodes).toBeGreaterThanOrEqual(1)

    // 4) 回放推送（注意端点为 /api/plugin/trace/push，复用创建 DTO 结构）
    const replay = await api.post('/api/plugin/trace/push', {
      data: {
        chainName: 'replay',
        interfaceList: [
          { nodeName: 'n1', method: 'GET', url: 'https://example.com/a', sort: 1 },
        ],
      },
    })
    expect((await replay.json()).code).toBe(200)
  })
})
