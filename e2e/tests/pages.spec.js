// pages.spec.js —— 其余页面的冒烟测试（关键元素 + 一个核心操作）
// 约定：页面标题用 .app-main 限定（与侧边栏菜单同名，避免 strict mode 冲突）；
//       弹窗内元素用 getByRole('dialog') 作容器（el-dialog 默认 teleport 到 body）。
import { test, expect } from '@playwright/test'

test.describe('系统设置', () => {
  test('页面元素与保存配置', async ({ page }) => {
    await page.goto('/system/config')
    await expect(page.locator('.app-main').getByText('系统设置')).toBeVisible()
    await expect(page.locator('.app-main').getByText('大模型配置')).toBeVisible()
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('配置已保存')).toBeVisible()
  })
})

test.describe('测试账号管理', () => {
  test('新增账号弹窗可打开', async ({ page }) => {
    await page.goto('/account/list')
    await expect(page.locator('.app-main').getByText('测试账号管理')).toBeVisible()
    await page.getByRole('button', { name: '新增账号' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // 弹窗内的「账号编码」是表单 label（非 placeholder），用 dialog 限定
    await expect(dialog.getByText('账号编码')).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
  })
})

test.describe('分类管理', () => {
  test('新增根分类弹窗可打开', async ({ page }) => {
    await page.goto('/dict/category')
    await expect(page.locator('.app-main').getByText('分类管理')).toBeVisible()
    await page.getByRole('button', { name: '新增根分类' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('分类名称')).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
  })
})

test.describe('浏览器插件', () => {
  test('下载按钮可触发 .crx 下载', async ({ page }) => {
    await page.goto('/plugin/download')
    await expect(page.locator('.app-main').getByText('浏览器插件')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /下载插件/ }).click(),
    ])
    expect(download.suggestedFilename()).toContain('traceflow-plugin.crx')
  })
})

test.describe('用户管理', () => {
  test('管理员用户在列表中可见', async ({ page }) => {
    await page.goto('/user/list')
    await expect(page.locator('.app-main').getByText('用户管理')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()
    // 等表格数据加载，admin 用户（用户名 admin）应出现在列表中
    await expect(page.locator('.el-table__row').first()).toBeVisible()
    await expect(page.locator('.app-main').getByText('admin')).toBeVisible()
  })
})

test.describe('定时任务管理', () => {
  test('新增任务弹窗可打开', async ({ page }) => {
    await page.goto('/scheduled-task')
    await expect(page.locator('.app-main').getByText('定时任务管理')).toBeVisible()
    await page.getByRole('button', { name: '新增任务' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('任务名称')).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
  })
})
