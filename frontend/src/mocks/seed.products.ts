import type { ProductDescriptor, ProductUpdateCycle } from '@/types/data-workbench'
import type { SeedDataService } from '@/types/seed'
import { seedDatasets } from '@/mocks/seed'

const DATASET_BY_SERVICE: Record<string, string> = {
  'ds-gaofen-optical': 'dset-optical-snapshot',
  'ds-sar-maritime': 'dset-sar-wide',
  'ds-payload-telemetry': 'dset-payload-daily',
  'ds-infrared-weak': 'dset-infrared-seq',
  'ds-sst-field': 'dset-sst-field',
  'ds-altimetry': 'dset-altimetry',
  'ds-ship-track': 'dset-ship-track',
  'ds-night-light': 'dset-night-light',
  'ds-ndvi': 'dset-ndvi',
  'ds-sea-ice': 'dset-sea-ice',
  'ds-optical-archive': 'dset-optical-archive',
  'ds-sar-wide': 'dset-sar-wide',
}

const CYCLES: ProductUpdateCycle[] = ['日更', '周更', '月更', '季更']
const FORMAT_SETS = [
  ['GeoTIFF', 'CSV'],
  ['NetCDF', 'CSV'],
  ['HDF5', 'CSV'],
  ['COG', 'GeoJSON'],
]

function typeOf(name: string): string {
  if (name.includes('time') || name.endsWith('_at')) return 'datetime'
  if (name.includes('cover') || name.includes('rate') || name.includes('celsius')) return 'number'
  return 'string'
}

export function productDescriptorOf(service: SeedDataService, index: number): ProductDescriptor {
  const dataset = seedDatasets.find((item) => item.code === DATASET_BY_SERVICE[service.code])
  const cycle = CYCLES[index % CYCLES.length]
  const formats = FORMAT_SETS[index % FORMAT_SETS.length]
  const confidential = service.classification === 'CONFIDENTIAL'
  const applyRequirements = confidential
    ? ['密级：机密，需签署知悉承诺书', '角色：数据使用人或项目负责人', '配额：单次不超过 1 个景次包']
    : ['密级：内部，登录门户即可申请', '角色：分析师或业务用户', '配额：按组织月度额度扣减']

  const fieldSpecs = (dataset?.fieldSpecs ?? []).map((field) => ({
    name: field.name,
    type: typeOf(field.name),
    desc: field.desc,
  }))

  const sample = dataset
    ? {
        columns: dataset.sampleColumns,
        rows: dataset.sampleRows.slice(0, 5).map((row) =>
          Object.fromEntries(dataset.sampleColumns.map((column, columnIndex) => [column, row[columnIndex]])),
        ),
      }
    : { columns: [], rows: [] }

  return {
    overview: `${service.name}，覆盖东海示范区遥感海洋业务，按${cycle}发布。`,
    fieldSpecs: service.code === 'ds-optical-archive' ? [] : fieldSpecs,
    sample: service.code === 'ds-optical-archive' ? { columns: [], rows: [] } : sample,
    updateCycle: cycle,
    applyRequirements,
    delivery: {
      formats,
      channel: confidential ? '受控对象存储，审批通过后投递' : '门户订阅签页在线领取',
      sla: cycle === '日更' ? '过境后 6 小时内可申请' : `${cycle}窗口关闭后 1 个工作日可申请`,
    },
    // B2-1：产品详情"关联数据资产"节的数据来源（产品 → 底层数据集映射）。
    asset: dataset
      ? { code: dataset.code, name: dataset.name, version: dataset.version, qualityPassRate: dataset.qualityPassRate }
      : undefined,
  }
}
