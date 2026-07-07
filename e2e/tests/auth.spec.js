// auth.spec.js —— 登录鉴权相关测试
// 这个文件刻意「不复用」全局登录态：用 test.use 把 storageState 覆盖成空白，
// 让每个用例都从「未登录」开始，才能真的验证登录页与路由守卫的拦截逻辑。
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('登录鉴权', () => {
  test('登录页基础元素正常', async ({ browser }) => {
    const context = await browser.newContext() // 空白 storageState -> 未登录
    const page = await context.newPage()
    await page.goto('/login')

    // 标题、输入框、按钮、默认账号提示都应出现
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await expect(page.getByPlaceholder('用户名')).toBeVisible()
    await expect(page.getByPlaceholder('密码')).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
    await expect(page.getByText('默认账号: admin / admin123')).toBeVisible()

    // 未登录访问受保护页面应被路由守卫踢回登录页
    await page.goto('/chain/list')
    await expect(page).toHaveURL(/\/login/)
    await context.close()
  })

  test('错误密码无法登录', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('wrong-password')
    await page.getByRole('button', { name: '登录' }).click()

    // 密码错误时停留在登录页，并弹出错误提示
    // 注意：后端登录失败返回 HTTP 200 + code:401，前端兜底提示「登录失败」
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('登录失败')).toBeVisible()
    await context.close()
  })

  test('正确账号密码可登录并进入链路列表', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByPlaceholder('用户名').fill('admin')
    await page.getByPlaceholder('密码').fill('admin123')
    await page.getByRole('button', { name: '登录' }).click()

    // 登录成功 -> 跳转到链路列表，且能在「主内容区」看到「测试链路管理」标题
    await expect(page).toHaveURL(/\/chain\/list/)
    await expect(page.locator('.app-main').getByText('测试链路管理')).toBeVisible()
    await context.close()
  })
})
