import { expect, test } from '@playwright/test'

const criticalRoutes = [
  '/home',
  '/assistant',
  '/todos',
  '/personal',
  '/personal/tasks',
  '/personal/approvals',
  '/personal/requirements',
  '/personal/results',
  '/personal/notifications',
  '/data-workbench',
  '/algorithm-workbench',
  '/admin/operations',
  '/admin/requirements',
  '/admin/approvals',
  '/admin/iam',
]

test('键盘可完成全局命令、工作台下钻和算法分类筛选', async ({ page }) => {
  await page.goto('/personal')
  await expect(page.getByRole('button', { name: '查看进行中任务' })).toBeVisible()

  await page.getByRole('button', { name: '查看进行中任务' }).press('Enter')
  await expect(page).toHaveURL(/\/personal\/tasks$/)

  await page.goto('/algorithm-workbench')
  const category = page.getByRole('button', { name: '预测' })
  await category.press('Enter')
  await expect(category).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Control+k')
  await expect(page.getByText('快速命令', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '折叠导航' }).press('Enter')
  await expect(page.getByRole('button', { name: '展开导航' })).toBeVisible()
})

for (const route of criticalRoutes) {
  test(`${route} 在本地模拟下可访问且没有页面脚本错误`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(route)
    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.locator('main')).toBeVisible()
    await page.waitForLoadState('networkidle')

    expect(pageErrors).toEqual([])
  })
}
