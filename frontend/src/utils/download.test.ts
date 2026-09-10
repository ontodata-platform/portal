import { afterEach, describe, expect, it, vi } from 'vitest'

import { csvFilename, downloadBlob, expandDemoRows, mockResultFile } from './download'

describe('download 工具', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('生成带 UTF-8 BOM 的 CSV，便于 Excel 打开不乱码', async () => {
    const blob = mockResultFile('海表温度预测', [
      { grid_id: 'G-01', sst_celsius: 18.2, region: '东海示范区' },
    ])
    expect(blob.type).toContain('text/csv')
    const bytes = await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    expect(text).toContain('grid_id,sst_celsius,region')
    expect(text).toContain('东海示范区')
  })

  it('样例行扩到 20~50 行', () => {
    const rows = expandDemoRows(['scene_id', 'region'], [['GF1-001', '东海']], 28)
    expect(rows.length).toBe(28)
    expect(rows[0]).toEqual({ scene_id: 'GF1-001', region: '东海' })
    expect(rows[27].scene_id).toContain('GF1-001')
  })

  it('触发浏览器下载并释放对象 URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-download')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.fn()
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag)
      if (tag === 'a') Object.assign(el, { click })
      return el
    })

    downloadBlob('demo.csv', 'text/csv', 'id,name\n1,东海')

    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-download')
  })

  it('文件名统一落到 csv', () => {
    expect(csvFilename('港区变化差分图.tif')).toBe('港区变化差分图.csv')
    expect(csvFilename('海表温度预测.csv')).toBe('海表温度预测.csv')
  })
})
