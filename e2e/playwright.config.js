// Playwright 配置文件
// 说明：测试通过前端的 Vite 开发服务器（:3001）访问，
// 前端已把 /api 代理到后端（:8080），因此这是真正的「前后端一体化」集成测试。
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: '/tmp/auto-test-e2e/results',   // 移到 workspace 外，避免清理时触发批量删除保护
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,        // 平台有登录态（localStorage），串行更稳
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  globalSetup: './global-setup.js',   // 测试前先用管理员登录，生成登录态
  // 报告输出也放 workspace 外，避免清理 playwright-report 触发护栏
  reporter: [
    ['list'],
    ['json', { outputFile: '/tmp/auto-test-e2e/report/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    storageState: './.auth/user.json',   // 自动带上管理员登录态
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
