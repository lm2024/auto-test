// execute.spec.js —— 执行记录列表 + 执行详情（含 WebSocket 实时更新）
// 先通过接口创建链路并执行，得到一条执行记录，再驱动 UI 校验。
import { test, expect } from '@playwright/test'
import { apiLogin, createChainWithNode, runChain } from '../helpers.js'

test.describe('执行记录与详情', () => {
  let executionId = ''

  test.beforeEach(async ({ page }) => {
    const token = await apiLogin()
    const chainCode = await createChainWithNode(token, 'E2E执行_' + Date.now())
    executionId = await runChain(token, chainCode)
    await page.goto('/execute/list')
  })

  test('执行列表页关键元素与查询', async ({ page }) => {
    await expect(page.locator('.app-main').getByText('执行记录查询')).toBeVisible()
    await expect(page.getByPlaceholder('链路编码')).toBeVisible()
    await expect(page.getByText('执行状态')).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    // 点击查询应正常刷新（不报错）
    await page.getByRole('button', { name: '查询' }).click()
    await expect(
      page.getByText('执行ID').or(page.getByText('暂无数据'))
    ).toBeVisible()
  })

  test('执行详情页：视图切换 + 节点卡片渲染 + 节点详情弹窗 + 复制', async ({ page }) => {
    test.skip(!executionId, '没有可用的执行记录')
    await page.goto(`/execute/detail/${executionId}`)

    // 顶部工具栏
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
    await expect(page.getByRole('button', { name: '平铺视图' })).toBeVisible()
    await expect(page.getByRole('button', { name: '分组视图' })).toBeVisible()

    // 关键：平铺视图必须真正渲染出节点卡片（曾因节点日志未落库导致整页空白）
    await expect(page.locator('.node-log-card').first()).toBeVisible({ timeout: 20000 })
    const flatCount = await page.locator('.node-log-card').count()
    expect(flatCount).toBeGreaterThan(0)

    // 切换到分组视图，同样要渲染出节点卡片
    await page.getByRole('button', { name: '分组视图' }).click()
    await expect(page.locator('.trace-node-card').first()).toBeVisible({ timeout: 10000 })
    const groupCount = await page.locator('.trace-node-card').count()
    expect(groupCount).toBeGreaterThan(0)
    // 切回平铺
    await page.getByRole('button', { name: '平铺视图' }).click()

    // 节点卡片上的「查看详情」-> 节点详情弹窗，内含复制按钮
    const detailBtn = page.getByRole('button', { name: '查看详情' }).first()
    if (await detailBtn.isVisible().catch(() => false)) {
      await detailBtn.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('节点详情')).toBeVisible()
      // 三个复制按钮（请求头/请求体/响应体）
      const copyBtn = dialog.getByRole('button', { name: '复制' }).first()
      await expect(copyBtn).toBeVisible()
      await copyBtn.click()
    }
  })

  test('执行详情页加载时 WebSocket 不会让页面崩溃，且内容正常渲染', async ({ page }) => {
    test.skip(!executionId, '没有可用的执行记录')
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`/execute/detail/${executionId}`)
    // 不再吞掉「节点卡片缺失」：必须等到至少一张卡片可见，否则判失败
    await expect(page.locator('.node-log-card').first()).toBeVisible({ timeout: 20000 })
    // 页面核心元素仍在，说明 WS 连接异常被兜住了
    await expect(page.getByRole('button', { name: '返回' })).toBeVisible()
    expect(errors).toEqual([])
  })
})
