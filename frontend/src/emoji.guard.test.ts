import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 界面禁用 emoji 当图标（ui-ux 基准 no-emoji-icons）：统一使用 @ant-design/icons-vue。
// 新增图标请选 antd 图标；发现命中请改 SVG 后再入库。
const FORBIDDEN = /💡|🚀|✅|❌|⚠️|📊|👉|🎉|🔎|🤖|📈|🔥|⭐/g

function collectVueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return collectVueFiles(full)
    return entry.name.endsWith('.vue') ? [full] : []
  })
}

const files = ['src/views', 'src/components', 'src/layouts'].flatMap(collectVueFiles)

describe('界面 emoji 图标守卫', () => {
  it('扫描范围内覆盖到视图文件', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('views/components/layouts 不使用 emoji 作图标', () => {
    const violations = files
      .map((file) => ({ file, hit: readFileSync(file, 'utf8').match(FORBIDDEN) }))
      .filter((entry) => entry.hit)
      .map((entry) => `${entry.file}: ${entry.hit!.join('')}`)
    expect(violations).toEqual([])
  })
})
