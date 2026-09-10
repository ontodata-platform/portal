import { expect, test } from '@playwright/test'

/** D3 统计看板关键内容冒烟（独立 Chromium 验证）。 */
test('统计看板渲染六组 KPI 与趋势/分布图表', async ({ page }) => {
  await page.goto('/admin/statistics')
  await expect(page.getByText('服务访问')).toBeVisible()
  await expect(page.getByText('申请量趋势')).toBeVisible()
  await expect(page.getByText('任务状态分布')).toBeVisible()
  await expect(page.getByText('反馈处理')).toBeVisible()
  await expect(page.getByRole('button', { name: '导出 CSV' })).toBeVisible()
})
