import { expect, test } from '@playwright/test'

/** D3 统计看板关键内容冒烟（独立 Chromium 验证）。 */
test('统计看板渲染六组 KPI 与趋势/分布图表', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/admin/statistics')
  // 冷启动依赖优化可能较慢：先等 KPI 卡渲染
  await page.waitForSelector('.kpi-card', { timeout: 30_000 })
  await expect(page.getByText('服务访问').first()).toBeVisible()
  await expect(page.getByText('申请量趋势').first()).toBeVisible()
  await expect(page.getByText('任务状态分布').first()).toBeVisible()
  await expect(page.getByText('反馈处理').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '导出 CSV' })).toBeVisible()
})
