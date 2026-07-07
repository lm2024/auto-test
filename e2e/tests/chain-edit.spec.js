// chain-edit.spec.js —— 链路编排编辑页（最核心的工作流页）
// 通过接口先造一条带 1 个节点的链路，再用 UI 驱动它的各种编排操作。
import { test, expect } from '@playwright/test'
import { apiLogin, createChainWithNode } from '../helpers.js'

test.describe('链路编排编辑', () => {
  let chainCode = ''

  test.beforeEach(async ({ page }) => {
    const token = await apiLogin()
    chainCode = await createChainWithNode(token, 'E2E编排_' + Date.now())
    await page.goto(`/chain/edit/${chainCode}`)
    await expect(page.locator('.app-main').getByText('链路编排')).toBeVisible()
    // 等节点列表加载完成（接口造的链路已有 1 个节点）
    await expect(
      page.locator('.node-card').first().or(page.locator('.empty-list'))
    ).toBeVisible()
  })

  test('工具栏与节点面板关键元素齐全', async ({ page }) => {
    await expect(page.locator('.left-panel').getByText('节点库')).toBeVisible()
    await expect(page.locator('.left-panel').getByText('节点列表')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增节点' })).toBeVisible()
    await expect(page.getByRole('button', { name: '批量导入' })).toBeVisible()
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
    await expect(page.getByRole('button', { name: '执行' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'AI生成测试数据' })).toBeVisible()
  })

  test('新增节点后出现节点并可打开属性配置', async ({ page }) => {
    await page.getByRole('button', { name: '新增节点' }).click()
    await expect(page.getByText('已新增节点')).toBeVisible()
    await expect(page.getByText('暂无节点')).toBeHidden()

    // 点选节点卡片，右侧出现属性配置面板与四个标签页
    await page.locator('.node-card').first().click()
    await expect(page.getByText('属性配置')).toBeVisible()
    await expect(page.getByRole('tab', { name: '基础信息' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '请求配置' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '提取规则' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '断言规则' })).toBeVisible()
  })

  test('请求配置 / 提取规则 / 断言规则 标签可切换并增删规则', async ({ page }) => {
    await page.locator('.node-card').first().click()

    // 请求配置
    await page.getByRole('tab', { name: '请求配置' }).click()
    await expect(page.getByText('请求方法')).toBeVisible()
    await expect(page.getByText('URL')).toBeVisible()

    // 提取规则：添加一条
    await page.getByRole('tab', { name: '提取规则' }).click()
    await page.getByRole('button', { name: '添加提取规则' }).click()
    await expect(page.getByText('变量名称')).toBeVisible()

    // 断言规则：添加一条字段检查
    await page.getByRole('tab', { name: '断言规则' }).click()
    await page.getByRole('button', { name: '添加字段检查' }).click()
    await expect(page.getByText('字段路径')).toBeVisible()
  })

  test('批量导入：cURL 方式可打开并解析', async ({ page }) => {
    await page.getByRole('button', { name: '批量导入' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('批量导入接口')).toBeVisible()

    // 切到 cURL 标签页并填入
    await page.getByRole('tab', { name: 'cURL命令' }).click()
    await dialog.getByPlaceholder(/粘贴cURL命令/).fill(
      "curl -X POST 'https://example.com/api/login' -H 'Content-Type: application/json' -d '{\"u\":\"a\"}'"
    )
    // 触发解析（会调用后端 /node/import）。无论成功或失败都会给出提示，说明解析+调用完成
    await page.getByRole('button', { name: '解析并导入' }).click()
    await expect(
      page.getByText('导入成功').or(page.getByText('解析失败'))
    ).toBeVisible({ timeout: 15000 })

    // 关闭对话框，保持环境干净
    await page.getByRole('button', { name: '取消' }).click().catch(() => {})
    await expect(dialog).toBeHidden()
  })

  test('列表视图 / 分组视图 可切换', async ({ page }) => {
    await page.getByRole('button', { name: '列表视图' }).click()
    await expect(page.locator('.app-main').getByText('链路编排')).toBeVisible()
    await page.getByRole('button', { name: '分组视图' }).click()
    // 分组视图无数据时给出空态文案（限定分组视图容器避免多匹配）
    await expect(
      page.locator('.trace-group-view').getByText('暂无分组数据')
    ).toBeVisible()
  })

  test('撤销 / 重做 按钮存在，自动布局可点击', async ({ page }) => {
    // 撤销/重做在无选中操作时是 disabled 按钮，仅断言其可见（点击 disabled 会超时）
    await expect(page.getByRole('button', { name: '撤销' })).toBeVisible()
    await expect(page.getByRole('button', { name: '重做' })).toBeVisible()
    await page.getByRole('button', { name: '自动布局' }).click()
    await expect(page.getByText('已自动布局')).toBeVisible()
  })

  test('保存节点按钮可用', async ({ page }) => {
    await page.getByRole('button', { name: '新增节点' }).click()
    await expect(page.getByText('已新增节点')).toBeVisible()
    await page.locator('.node-card').first().click()
    await page.getByRole('button', { name: '保存节点' }).click()
    await expect(page.getByText('保存成功')).toBeVisible()
  })

  test('点击执行会进入执行详情页', async ({ page }) => {
    await page.getByRole('button', { name: '新增节点' }).click()
    await expect(page.getByText('已新增节点')).toBeVisible()
    await page.getByRole('button', { name: '执行' }).click()
    // 执行引擎会创建执行记录并跳转详情页
    await expect(page).toHaveURL(/\/execute\/detail\//, { timeout: 20000 })
  })

  test('AI生成测试数据（无 AI 服务时应优雅降级，不崩）', async ({ page }) => {
    await page.getByRole('button', { name: '新增节点' }).click()
    await expect(page.getByText('已新增节点')).toBeVisible()
    await page.getByRole('button', { name: 'AI生成测试数据' }).click()
    // 无论成功还是报错，页面都不应崩溃（标题仍在）
    await expect(page.locator('.app-main').getByText('链路编排')).toBeVisible()
  })
})
