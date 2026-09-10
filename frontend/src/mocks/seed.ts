import type {
  SeedAlgorithm,
  SeedDataApplication,
  SeedDataService,
  SeedDataset,
  SeedDataSubscription,
} from '@/types/seed'

const hour = 3600e3

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * hour).toISOString()
}

export function daysAgo(n: number): string {
  return hoursAgo(n * 24)
}

/** 兼容存量 mock：按小时回推 ISO 时间。 */
export function relativeIso(hoursAgoCount: number): string {
  return hoursAgo(hoursAgoCount)
}

export const demoIdentity = {
  name: '陈晓',
  title: '遥感分析师',
  team: '空间信息应用团队',
  tenantId: 'default',
  orgId: 'space-information',
  projectId: 'proj-remote-sensing',
  roles: ['user', 'operator'],
  devMode: true,
}

export const seedDataServices: SeedDataService[] = [
  {
    code: 'ds-gaofen-optical',
    name: '高分光学卫星影像-东海重点海域',
    version: '2.1.0',
    classification: 'INTERNAL',
    source: 'data-platform',
    subscribed: true,
  },
  {
    code: 'ds-sar-maritime',
    name: 'SAR海面目标检测辅助数据',
    version: '1.4.2',
    classification: 'CONFIDENTIAL',
    source: 'data-platform',
    subscribed: false,
  },
  {
    code: 'ds-payload-telemetry',
    name: '卫星载荷遥测-轨次增量',
    version: '3.0.1',
    classification: 'INTERNAL',
    source: 'data-platform',
    subscribed: false,
  },
]

export const seedAlgorithms: SeedAlgorithm[] = [
  {
    code: 'tpl-quality-weekly',
    name: '目标特性提取-周批',
    kind: 'template',
    version: '1.2.0',
    status: 'admitted',
  },
  {
    code: 'cap-anomaly-detect',
    name: '载荷遥测异常检测',
    kind: 'capability',
    version: '2.0.0',
    status: 'admitted',
  },
  {
    code: 'tpl-churn-train',
    name: '海表温度时序预测-训练',
    kind: 'template',
    version: '0.9.0',
    status: 'draft',
  },
]

export const seedIntents = [
  { id: 'find-data', icon: 'search', title: '找数据服务', example: '帮我找东海高分光学影像服务' },
  { id: 'run-algo', icon: 'experiment', title: '跑目标特性提取', example: '跑一遍港区目标特性提取' },
  { id: 'todos', icon: 'audit', title: '看今日待办', example: '我有哪些待办审批' },
  { id: 'grant', icon: 'safety', title: '申请开通', example: '申请开通SAR海面目标检测数据' },
  { id: 'predict', icon: 'line-chart', title: '做态势预测', example: '用载荷遥测趋势预测分析一下' },
  { id: 'notify', icon: 'bell', title: '查通知', example: '看看未读通知' },
]

const opticalFields = [
  { name: 'scene_id', desc: '景号（主键）' },
  { name: 'acquisition_time', desc: '过境成像时间' },
  { name: 'cloud_cover', desc: '云量百分比' },
  { name: 'region', desc: '覆盖海域' },
]

export const seedDatasets: SeedDataset[] = [
  {
    code: 'dset-optical-snapshot',
    name: '高分光学影像快照',
    domain: '光学影像',
    classification: '内部',
    version: 'v2026.08',
    snapshotHoursAgo: 24 * 7,
    qualityPassRate: '99.2%',
    status: 'ONLINE',
    description: '东海示范区高分光学卫星影像月度快照，供目标特性提取与订阅投递。',
    fieldSpecs: opticalFields,
    sampleColumns: ['scene_id', 'acquisition_time', 'cloud_cover', 'region'],
    sampleRows: [
      ['GF-E-1001', '2026-09-03T02:18:00Z', '6.2', '东海示范区'],
      ['GF-E-1002', '2026-09-04T02:11:00Z', '12.4', '舟山港区'],
      ['GF-E-1003', '2026-09-05T02:22:00Z', '4.1', '长江口外'],
      ['GF-E-1004', '2026-09-06T02:09:00Z', '18.7', '杭州湾'],
      ['GF-E-1005', '2026-09-07T02:16:00Z', '9.0', '东海示范区'],
    ],
  },
  {
    code: 'dset-payload-daily',
    name: '载荷遥测日增量',
    domain: '载荷遥测',
    classification: '机密',
    version: 'v2026.09.01',
    snapshotHoursAgo: 8,
    qualityPassRate: '97.8%',
    status: 'ONLINE',
    description: '卫星载荷遥测日增量，含电压、温度与姿态测点，经野值清洗。',
    fieldSpecs: [
      { name: 'orbit_id', desc: '轨次编号' },
      { name: 'payload_id', desc: '载荷标识' },
      { name: 'voltage', desc: '母线电压（V）' },
      { name: 'temperature', desc: '舱温（℃）' },
    ],
    sampleColumns: ['orbit_id', 'payload_id', 'voltage', 'temperature'],
    sampleRows: [
      ['ORB-7721', 'IR-A', '28.4', '18.2'],
      ['ORB-7721', 'IR-B', '28.1', '19.0'],
      ['ORB-7722', 'IR-A', '28.6', '17.8'],
      ['ORB-7722', 'SAR-1', '27.9', '21.4'],
      ['ORB-7723', 'OPT-1', '28.3', '18.6'],
    ],
  },
  {
    code: 'dset-sst-field',
    name: '海表温度场',
    domain: '海洋环境',
    classification: '内部',
    version: 'v3.0.1',
    snapshotHoursAgo: 24 * 18,
    qualityPassRate: '98.6%',
    status: 'ONLINE',
    description: '东海示范区海表温度场格点产品，支持按海域与时效检索。',
    fieldSpecs: [
      { name: 'grid_id', desc: '格点编号' },
      { name: 'sst_celsius', desc: '海表温度（℃）' },
      { name: 'region', desc: '海域分区' },
      { name: 'valid_at', desc: '场次有效时间' },
    ],
    sampleColumns: ['grid_id', 'sst_celsius', 'region', 'valid_at'],
    sampleRows: [
      ['SST-E-01', '24.1', '东海示范区', '2026-08-23T00:00:00Z'],
      ['SST-E-02', '23.6', '舟山近岸', '2026-08-23T00:00:00Z'],
      ['SST-E-03', '22.8', '长江口外', '2026-08-23T00:00:00Z'],
      ['SST-E-04', '24.7', '杭州湾', '2026-08-23T00:00:00Z'],
      ['SST-E-05', '21.9', '黄海南部', '2026-08-23T00:00:00Z'],
    ],
  },
  {
    code: 'dset-ship-track',
    name: '舰船目标轨迹库',
    domain: '目标轨迹',
    classification: '内部',
    version: 'v2026.08',
    snapshotHoursAgo: 24 * 8,
    qualityPassRate: '99.5%',
    status: 'ONLINE',
    description: '光学与 SAR 融合的舰船目标轨迹库，含航迹点与关联置信度。',
    fieldSpecs: [
      { name: 'track_id', desc: '航迹编号' },
      { name: 'mmsi', desc: '船舶识别码（脱敏）' },
      { name: 'lon', desc: '经度' },
      { name: 'lat', desc: '纬度' },
    ],
    sampleColumns: ['track_id', 'mmsi', 'lon', 'lat'],
    sampleRows: [
      ['TRK-8801', 'M-10021', '122.41', '30.12'],
      ['TRK-8801', 'M-10021', '122.44', '30.15'],
      ['TRK-8802', 'M-10044', '121.98', '31.22'],
      ['TRK-8803', 'M-10067', '122.10', '29.88'],
      ['TRK-8804', 'M-10088', '123.02', '30.54'],
    ],
  },
  {
    code: 'dset-spectral',
    name: '光谱特征库',
    domain: '光谱',
    classification: '机密',
    version: 'v2026.08',
    snapshotHoursAgo: 24 * 9,
    qualityPassRate: '96.4%',
    status: 'ONLINE',
    description: '典型地物与海面目标光谱库，供弱小目标检测特征匹配。',
    fieldSpecs: [
      { name: 'sample_id', desc: '光谱样本号' },
      { name: 'wavelength', desc: '中心波长（nm）' },
      { name: 'reflectance', desc: '反射率' },
      { name: 'target_class', desc: '目标类别' },
    ],
    sampleColumns: ['sample_id', 'wavelength', 'reflectance', 'target_class'],
    sampleRows: [
      ['SP-201', '450', '0.062', '海面'],
      ['SP-202', '550', '0.081', '海面'],
      ['SP-203', '650', '0.044', '舰船甲板'],
      ['SP-204', '850', '0.210', '植被'],
      ['SP-205', '1650', '0.118', '港区设施'],
    ],
  },
  {
    code: 'dset-sea-ice',
    name: '海冰监测快照',
    domain: '海冰',
    classification: '内部',
    version: 'v2026.35',
    snapshotHoursAgo: 24 * 3,
    qualityPassRate: '99.1%',
    status: 'ONLINE',
    description: '黄渤海海冰密集度周度快照，支持按分区检索。',
    fieldSpecs: [
      { name: 'cell_id', desc: '网格单元' },
      { name: 'ice_conc', desc: '海冰密集度（%）' },
      { name: 'region', desc: '监测分区' },
      { name: 'observed_at', desc: '观测时间' },
    ],
    sampleColumns: ['cell_id', 'ice_conc', 'region', 'observed_at'],
    sampleRows: [
      ['ICE-01', '12.0', '渤海北部', '2026-09-07T00:00:00Z'],
      ['ICE-02', '4.2', '辽东湾', '2026-09-07T00:00:00Z'],
      ['ICE-03', '0.8', '莱州湾', '2026-09-07T00:00:00Z'],
      ['ICE-04', '18.6', '黄海北部', '2026-09-07T00:00:00Z'],
      ['ICE-05', '1.1', '山东半岛沿岸', '2026-09-07T00:00:00Z'],
    ],
  },
  {
    code: 'dset-qc-report',
    name: '影像质检报告库',
    domain: '质量',
    classification: '机密',
    version: 'v2026.08',
    snapshotHoursAgo: 24 * 10,
    qualityPassRate: '99.8%',
    status: 'ONLINE',
    description: '光学与 SAR 影像质检报告月度归集，含云量、条带与辐射指标。',
    fieldSpecs: [
      { name: 'report_id', desc: '质检单号' },
      { name: 'scene_id', desc: '关联景号' },
      { name: 'pass_rate', desc: '合格率' },
      { name: 'issue', desc: '主要问题' },
    ],
    sampleColumns: ['report_id', 'scene_id', 'pass_rate', 'issue'],
    sampleRows: [
      ['QC-3701', 'GF-E-1001', '99.4', '无'],
      ['QC-3702', 'GF-E-1002', '97.1', '薄云'],
      ['QC-3703', 'SAR-E-221', '98.8', '条带噪声'],
      ['QC-3704', 'GF-E-1004', '96.2', '薄雾'],
      ['QC-3705', 'IR-E-088', '99.0', '无'],
    ],
  },
  {
    code: 'dset-night-light',
    name: '夜间灯光影像',
    domain: '夜间灯光',
    classification: '内部',
    version: 'v2026.Q3',
    snapshotHoursAgo: 24 * 12,
    qualityPassRate: '98.9%',
    status: 'ONLINE',
    description: '沿岸港区夜间灯光辐射产品，用于设施活动强度研判。',
    fieldSpecs: [
      { name: 'tile_id', desc: '瓦片编号' },
      { name: 'radiance', desc: '辐射亮度' },
      { name: 'region', desc: '覆盖港区' },
      { name: 'observed_at', desc: '观测夜次' },
    ],
    sampleColumns: ['tile_id', 'radiance', 'region', 'observed_at'],
    sampleRows: [
      ['NL-11', '42.1', '舟山港区', '2026-08-29'],
      ['NL-12', '38.6', '宁波港', '2026-08-29'],
      ['NL-13', '21.4', '长江口外', '2026-08-29'],
      ['NL-14', '55.0', '上海港', '2026-08-29'],
      ['NL-15', '16.8', '杭州湾', '2026-08-29'],
    ],
  },
]

export const seedDatasetApplications: SeedDataApplication[] = [
  {
    code: 'app-2026-001',
    serviceCode: 'ds-gaofen-optical',
    serviceName: '高分光学影像快照',
    status: 'DELIVERED',
    submittedHoursAgo: 24 * 3,
    deliveredHoursAgo: 24 * 3 - 4.5,
    remark: '用于港区舰船目标特性提取与算法特征工程',
  },
  {
    code: 'app-2026-002',
    serviceCode: 'ds-payload-telemetry',
    serviceName: '载荷遥测日增量',
    status: 'PENDING',
    submittedHoursAgo: 24,
    currentApprover: '王主管（数据管理部）',
    remark: '轨次温度异常检测模型实时验证',
  },
  {
    code: 'app-2026-003',
    serviceCode: 'ds-sar-maritime',
    serviceName: 'SAR海面目标检测辅助数据',
    status: 'REJECTED',
    submittedHoursAgo: 24 * 10,
    rejectReason: '未附带所属项目立项批文与数据密级知悉承诺书',
    remark: '海面目标检测结果复核',
  },
]

export const seedDatasetSubscriptions: SeedDataSubscription[] = [
  {
    code: 'sub-001',
    serviceCode: 'ds-gaofen-optical',
    serviceName: '高分光学影像快照',
    version: 'v2026.08',
    snapshotHoursAgo: 24 * 7,
    expiresHoursAgo: -24 * 60,
    isExpiringSoon: false,
    deliveryType: 'DATASET',
    rowsCount: 12500,
    previewUrl: '/data-workbench/dataset/dset-optical-snapshot',
  },
  {
    code: 'sub-002',
    serviceCode: 'ds-payload-telemetry',
    serviceName: '载荷遥测日增量',
    version: 'v2026.09.01',
    snapshotHoursAgo: 8,
    expiresHoursAgo: -8,
    isExpiringSoon: true,
    deliveryType: 'SNAPSHOT',
    rowsCount: 86400,
    previewUrl: '/data-workbench/dataset/dset-payload-daily',
  },
  {
    code: 'sub-003',
    serviceCode: 'ds-sst-field',
    serviceName: '海表温度场',
    version: 'v3.0.1',
    snapshotHoursAgo: 24 * 18,
    expiresHoursAgo: -24 * 90,
    isExpiringSoon: false,
    deliveryType: 'DATASET',
    rowsCount: 4300,
    previewUrl: '/data-workbench/dataset/dset-sst-field',
  },
]
