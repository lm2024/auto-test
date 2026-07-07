// chains.spec.js —— 测试链路管理页（列表/新增/查询/分页/操作下拉）
import { test, expect } from '@playwright/test'

test.describe('测试链路管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chain/list')
    // 主内容区的标题（与侧边栏菜单同名，故用 .app-main 限定，避免 strict mode 冲突）
    await expect(page.locator('.app-main').getByText('测试链路管理')).toBeVisible()
  })

  test('页面关键元素齐全', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新增链路' })).toBeVisible()
    await expect(page.getByPlaceholder('链路名称')).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    await expect(page.locator('.el-pagination')).toBeVisible()
  })

  test('新增链路并能在列表中查到', async ({ page }) => {
    const name = 'E2E链路_' + Date.now()
    await page.getByRole('button', { name: '新增链路' }).click()

    // 弹出「新增链路」对话框
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('新增链路', { exact: true })).toBeVisible()

    // 在弹窗内填写（新增弹窗的「链路名称」输入框没有 placeholder，用第一个 input 定位）
    await dialog.locator('input').first().fill(name)
    await dialog.getByRole('button', { name: '确定' }).click()

    // 提示创建成功，对话框关闭
    await expect(page.getByText('创建成功')).toBeVisible()
    await expect(dialog).toBeHidden()

    // 用筛选框查到刚建的链路
    await page.getByPlaceholder('链路名称').fill(name)
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.app-main').getByText(name)).toBeVisible()
  })

  test('操作下拉可进入编排页', async ({ page }) => {
    // 第一行数据的「更多」下拉（操作列的圆形按钮）
    const firstRow = page.locator('.el-table__row').first()
    await firstRow.locator('.el-dropdown .el-button').click()
    // 下拉菜单出现，点击「编排」（多行菜单项同名，取第一个可见的）
    await page.getByRole('menuitem', { name: '编排' }).first().click()
    await expect(page).toHaveURL(/\/chain\/edit\//)
    await expect(page.locator('.app-main').getByText('链路编排')).toBeVisible()
  })

  test('查询筛选可正常工作', async ({ page }) => {
    // 输入一个几乎不可能存在的名字，查询后表格应为空
    await page.getByPlaceholder('链路名称').fill('__不存在的链路__')
    await page.getByRole('button', { name: '查询' }).click()
    await expect(page.locator('.el-table__row')).toHaveCount(0)
  })
})
