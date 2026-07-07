// global-setup.js
// 作用：在跑所有测试前，用「管理员账号」在真实浏览器里登录一次，
// 把登录后的状态（包含 localStorage 里的 JWT）保存成 .auth/user.json。
// 之后每个测试用例都自动复用这个登录态，不用每次都重新登录，又快又稳。
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE_URL = 'http://localhost:3001'
const AUTH_DIR = new URL('./.auth', import.meta.url).pathname
const AUTH_FILE = new URL('./.auth/user.json', import.meta.url).pathname

async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/login`)
  await page.getByPlaceholder('用户名').fill('admin')
  await page.getByPlaceholder('密码').fill('admin123')
  await page.getByRole('button', { name: '登录' }).click()
  // 登录成功后会被前端路由重定向到链路列表页
  await page.waitForURL('**/chain/list', { timeout: 20000 })

  await context.storageState({ path: AUTH_FILE })
  await browser.close()
  console.log('✅ 登录态已保存 ->', AUTH_FILE)
}

export default globalSetup
