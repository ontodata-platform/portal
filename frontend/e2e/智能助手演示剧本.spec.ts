import { expect, test } from '@playwright/test'

import { assistantDemoCases } from '../src/mocks/assistant/fixtures'

/**
 * A7-3 智能助手演示剧本：8 条标准问句在纯前端（mock）模式下依序提问，
 * 断言每轮应答"有内容"（关键文案出现）且关键剧本"有出口"（确认卡按钮可见）。
 * 顺序执行以覆盖一轮上下文剧本（followup 依赖前一问的命中实体）。
 */
test.describe('智能助手演示剧本（A7）', () => {
  test('8 条演示问句依序可得到有内容、有出口的应答', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/assistant')

    const input = page.locator('textarea.hero-input')
    const send = page.locator('button.send-btn')

    for (const demo of assistantDemoCases) {
      await input.fill(demo.question)
      await send.click()

      for (const fragment of demo.expect.textIncludes ?? []) {
        await expect(page.getByText(fragment).first()).toBeVisible({ timeout: 15_000 })
      }
      if (demo.expect.hasConfirm) {
        await expect(page.getByRole('button', { name: '确认执行' }).first()).toBeVisible({ timeout: 15_000 })
      }

      // 等流式输出收尾后再发下一问，避免输入被禁用打断
      await page.waitForTimeout(1_500)
    }
  })
})
