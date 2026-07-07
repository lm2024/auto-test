// helpers.js —— 跨测试复用的小工具
// 这里用 Playwright 的「纯接口请求」能力（不打开浏览器）直接调后端，
// 用来在测试前准备数据（比如先造一条链路），属于「接口层」的辅助。
import { request } from '@playwright/test'

export const BASE_API = 'http://localhost:8080'

// 调登录接口拿 token（后端返回 {code:200, data:{token}}）
export async function apiLogin(username = 'admin', password = 'admin123') {
  const ctx = await request.newContext()
  const res = await ctx.post(`${BASE_API}/api/user/login`, {
    data: { username, password },
  })
  const body = await res.json()
  if (body.code !== 200 || !body.data?.token) {
    throw new Error('登录失败: ' + JSON.stringify(body))
  }
  return body.data.token
}

// 通过「插件创建链路」接口造一条带 1 个节点的链路，返回 chainCode
export async function createChainWithNode(token, name) {
  const ctx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const res = await ctx.post(`${BASE_API}/api/plugin/chain/create`, {
    data: {
      chainName: name || 'E2E_' + Date.now(),
      interfaceList: [
        {
          nodeName: 'node1',
          method: 'GET',
          url: 'https://example.com/health',
          sort: 1,
        },
      ],
    },
  })
  const body = await res.json()
  if (body.code !== 200 || !body.data?.chainCode) {
    throw new Error('创建链路失败: ' + JSON.stringify(body))
  }
  return body.data.chainCode
}

// 执行一条链路，返回 executionId（执行引擎会异步跑，但执行记录会立即生成）
export async function runChain(token, chainCode) {
  const ctx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const res = await ctx.post(`${BASE_API}/api/execute/run`, {
    data: { chainCode },
  })
  const body = await res.json()
  return body.data?.executionId
}
