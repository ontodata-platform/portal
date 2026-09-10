import type { SeedFeedback, SeedNotice, SeedNotification, SeedResult, SeedUser } from '@/types/seed'

const hour = 3600e3

function relativeIso(hoursAgoCount: number): string {
  return new Date(Date.now() - hoursAgoCount * hour).toISOString()
}

type RecordValue = Record<string, unknown>

export const seedUsers: SeedUser[] = [
  { id: 'u-chen', name: '陈晓', username: 'chenxiao', tenantId: 'default', roles: ['operator', 'user'], status: 'ACTIVE' },
  { id: 'u-alice', name: 'alice', username: 'alice', tenantId: 'default', roles: ['user', 'data-manager'], status: 'ACTIVE' },
  { id: 'u-bob', name: 'bob', username: 'bob', tenantId: 'default', roles: ['user', 'algorithm-operator'], status: 'ACTIVE' },
  { id: 'u-wang', name: '王工', username: 'wanggong', tenantId: 'default', roles: ['user', 'data-manager'], status: 'ACTIVE' },
  { id: 'u-li', name: '李工', username: 'ligong', tenantId: 'default', roles: ['portal-admin', 'approval-approver'], status: 'ACTIVE' },
  { id: 'u-zhang', name: '张晓明', username: 'zhangxm', tenantId: 'default', roles: ['user'], status: 'ACTIVE' },
  { id: 'u-zhou', name: '周研', username: 'zhouyan', tenantId: 'default', roles: ['user', 'operator'], status: 'ACTIVE' },
  { id: 'u-sun', name: '孙航', username: 'sunhang', tenantId: 'default', roles: ['user', 'algorithm-operator'], status: 'ACTIVE' },
  { id: 'u-wu', name: '吴敏', username: 'wumin', tenantId: 'default', roles: ['user', 'data-manager'], status: 'ACTIVE' },
  { id: 'u-zheng', name: '郑涛', username: 'zhengtao', tenantId: 'default', roles: ['approval-approver', 'user'], status: 'ACTIVE' },
]

export const seedNotices: SeedNotice[] = [
  { code: 'ntc-001', title: '东海港区目标特性提取批次已开放', content: '港区目标特性提取流程已对空间信息应用团队开放，可在算法工作台提交。', section: '公告', status: 'PUBLISHED', publishedHoursAgo: 6, createdHoursAgo: 8 },
  { code: 'ntc-002', title: '遥感数据服务目录更新', content: '新增SAR海面目标检测辅助数据，支持申请后审批投递。', section: '服务动态', status: 'PUBLISHED', publishedHoursAgo: 20, createdHoursAgo: 22 },
  { code: 'ntc-003', title: '海表温度场专题上线', content: '东海示范区海表温度场可按格点订阅，用于航次保障。', section: '专题', status: 'PUBLISHED', publishedHoursAgo: 30, createdHoursAgo: 36 },
  { code: 'ntc-004', title: '夜间灯光产品周更说明', content: '沿岸港区夜间灯光改为周更，周五固化快照。', section: '服务动态', status: 'PUBLISHED', publishedHoursAgo: 48, createdHoursAgo: 50 },
  { code: 'ntc-005', title: '海冰监测进入秋季加密', content: '黄渤海海冰监测加密至三日一景，质检报告同步更新。', section: '公告', status: 'PUBLISHED', publishedHoursAgo: 72, createdHoursAgo: 74 },
  { code: 'ntc-006', title: '测高波形专题预告', content: '测高波形产品将于本周对算法运营开放试运行。', section: '专题', status: 'DRAFT', createdHoursAgo: 10 },
]

export const seedFeedbacks: SeedFeedback[] = [
  { code: 'fb-001', title: '光学影像云量字段口径咨询', content: '申请条件里的云量阈值是否按景还是按条带统计？', contact: 'alice', status: 'PENDING', createdHoursAgo: 12 },
  { code: 'fb-002', title: 'SAR 订阅投递延迟', content: '上周通过的 SAR 申请尚未看到交付快照。', contact: '王工', status: 'PENDING', createdHoursAgo: 20 },
  { code: 'fb-003', title: '目标特性提取耗时反馈', content: '周批任务在港区范围比标称多出约 4 分钟。', contact: 'bob', status: 'HANDLED', createdHoursAgo: 40 },
  { code: 'fb-004', title: '海表温度场下载格式', content: '希望补充 GeoTIFF 交付，而不仅是 CSV。', contact: '周研', status: 'HANDLED', createdHoursAgo: 56 },
  { code: 'fb-005', title: '载荷遥测异常检测误报', content: 'IR-B 载荷在换轨时段被标成异常，建议排除姿态调整窗。', contact: '孙航', status: 'PENDING', createdHoursAgo: 8 },
]

export const seedNotifications: SeedNotification[] = [
  { id: 'ntf-001', type: 'APPROVAL_DECIDED', title: '有一项数据服务申请待审批', body: '请在审批中心处理东海高分光学影像服务申请。', resourceRef: 'apr-data-001', createdHoursAgo: 2 },
  { id: 'ntf-002', type: 'TASK_COMPLETED', title: '数据导入任务已完成', body: 'SAR海面目标检测辅助数据质量校验已通过。', resourceRef: 'tsk-import-002', createdHoursAgo: 6, readHoursAgo: 3 },
  { id: 'ntf-003', type: 'REQUIREMENT_ASSIGNED', title: '红外弱小目标需求已分派', body: 'req-003 已进入算法运营办理。', resourceRef: 'req-003', createdHoursAgo: 10 },
  { id: 'ntf-004', type: 'APPROVAL_OVERDUE', title: 'SAR 申请已超期', body: 'apr-overdue-003 超过办理时限，请尽快处理。', resourceRef: 'apr-overdue-003', createdHoursAgo: 5 },
  { id: 'ntf-005', type: 'RESULT_READY', title: '目标特性报告可领取', body: 'result-quality-002 已生成，可在结果签页下载。', resourceRef: 'result-quality-002', createdHoursAgo: 14 },
  { id: 'ntf-006', type: 'NOTICE', title: '海表温度场专题上线', body: '首页公告已更新，可查看专题说明。', resourceRef: 'ntc-003', createdHoursAgo: 28, readHoursAgo: 20 },
  { id: 'ntf-007', type: 'TASK_FAILED', title: '航迹关联运行失败', body: '输入轨迹库版本不兼容，请更换后重试。', resourceRef: 'tsk-run-004', createdHoursAgo: 18 },
  { id: 'ntf-008', type: 'APPROVAL_DECIDED', title: '载荷遥测订阅已通过', body: 'apr-delivery-002 已批准，等待投递。', resourceRef: 'apr-delivery-002', createdHoursAgo: 22, readHoursAgo: 16 },
]

export const seedResults: SeedResult[] = [
  { resultId: 'result-quality-002', sourceSystem: 'data-platform', resultType: 'QUALITY_REPORT', resourceRefs: ['ds-sar-maritime@v1.4.2'], metadata: { title: '质量分析报告-2026W37', qualityScore: 98 }, sourceTaskId: 'tsk-import-002', traceId: 'mock-trace-import-002', createdHoursAgo: 12, hasFile: true },
  { resultId: 'result-anomaly-001', sourceSystem: 'algorithm-recombine', resultType: 'REPORT', resourceRefs: ['cap-anomaly-detect@2'], metadata: { title: '载荷遥测异常轨次清单' }, sourceTaskId: 'tsk-run-003', createdHoursAgo: 20, hasFile: true },
  { resultId: 'result-payload-001', sourceSystem: 'data-platform', resultType: 'DATASET', resourceRefs: ['ds-payload-telemetry@v3.0.1'], metadata: { title: '载荷遥测轨次增量' }, sourceTaskId: 'tsk-import-005', createdHoursAgo: 30, hasFile: true },
  { resultId: 'result-optical-001', sourceSystem: 'data-platform', resultType: 'DATASET', resourceRefs: ['ds-gaofen-optical@2.1.0'], metadata: { title: '东海高分光学快照' }, createdHoursAgo: 16, hasFile: true },
  { resultId: 'result-sst-001', sourceSystem: 'algorithm-recombine', resultType: 'REPORT', resourceRefs: ['cap-timeseries-forecast@1'], metadata: { title: '海表温度预测周报' }, createdHoursAgo: 40, hasFile: true },
  { resultId: 'result-track-001', sourceSystem: 'algorithm-recombine', resultType: 'BUSINESS_DATA', resourceRefs: ['cap-track-associate@1'], metadata: { title: '舰船航迹关联表' }, createdHoursAgo: 8, hasFile: true },
  { resultId: 'result-ice-001', sourceSystem: 'data-platform', resultType: 'DATASET', resourceRefs: ['ds-sea-ice@1'], metadata: { title: '海冰密集度快照' }, createdHoursAgo: 26, hasFile: true },
  { resultId: 'result-pending-001', sourceSystem: 'algorithm-recombine', resultType: 'REPORT', resourceRefs: ['tpl-quality-weekly@1'], metadata: { title: '目标特性报告生成中' }, createdHoursAgo: 2, hasFile: false },
  { resultId: 'result-pending-002', sourceSystem: 'data-platform', resultType: 'DATASET', resourceRefs: ['ds-night-light@1'], metadata: { title: '夜间灯光投递中' }, createdHoursAgo: 4, hasFile: false },
  { resultId: 'result-change-001', sourceSystem: 'algorithm-recombine', resultType: 'REPORT', resourceRefs: ['cap-change-detect@1'], metadata: { title: '港区变化检测差分图' }, createdHoursAgo: 36, hasFile: true },
]

function stamp(hoursAgo: number) {
  return relativeIso(hoursAgo)
}

export function createSeedApprovals(): RecordValue[] {
  return [
    { code: 'apr-data-001', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-gaofen-optical', title: '东海高分光学影像服务使用申请', requester: '张晓明', status: 'PENDING', slaStatus: 'ON_TIME', detail: { serviceCode: 'ds-gaofen-optical', grantedColumns: ['scene_id', 'acquisition_time', 'cloud_cover'] }, createdAt: stamp(8), updatedAt: stamp(6) },
    { code: 'apr-r4-sample', approvalType: 'R4_TOOL_CALL', sourceSystem: 'mcp-gateway', sourceCode: 'cfm-sample', title: '调用工作流提交工具需要审批', requester: '陈晓', status: 'PENDING', slaStatus: 'ON_TIME', detail: { tool: 'workflow.submit_execution', riskLevel: 'R4' }, createdAt: stamp(4), updatedAt: stamp(3) },
    { code: 'apr-delivery-002', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-payload-telemetry', title: '卫星载荷遥测服务订阅', requester: '陈晓', status: 'APPROVED', slaStatus: 'MET', detail: { serviceCode: 'ds-payload-telemetry', deliveryStatus: 'FAILED', deliveryError: '等待管理平台重新投递' }, createdAt: stamp(20), updatedAt: stamp(6), decisionAt: stamp(6), decisionBy: '陈晓' },
    { code: 'apr-overdue-003', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-sar-maritime', title: 'SAR海面目标检测辅助数据超期未批', requester: '王工', status: 'PENDING', slaStatus: 'OVERDUE', slaDeadline: stamp(30), detail: { serviceCode: 'ds-sar-maritime' }, createdAt: stamp(48), updatedAt: stamp(6) },
    { code: 'apr-due-004', approvalType: 'R4_TOOL_CALL', sourceSystem: 'mcp-gateway', sourceCode: 'cfm-due-soon', title: '临期工具调用审批', requester: 'alice', status: 'PENDING', slaStatus: 'DUE_SOON', slaDeadline: relativeIso(-4), detail: { tool: 'dataset.export', riskLevel: 'R4' }, createdAt: stamp(20), updatedAt: stamp(2) },
    { code: 'apr-today-005', approvalType: 'SYSTEM_PERMISSION', sourceSystem: 'portal', sourceCode: 'role-operator', title: '运营角色开通申请', requester: 'bob', status: 'APPROVED', slaStatus: 'MET', decisionBy: '陈晓', decisionAt: stamp(2), createdAt: stamp(10), updatedAt: stamp(2) },
    { code: 'apr-0201', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-sst-field', title: '海表温度场订阅申请', requester: '周研', status: 'PENDING', slaStatus: 'ON_TIME', createdAt: stamp(14), updatedAt: stamp(12) },
    { code: 'apr-0202', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-ship-track', title: '舰船目标轨迹库使用申请', requester: '孙航', status: 'APPROVED', slaStatus: 'MET', createdAt: stamp(36), updatedAt: stamp(18), decisionBy: '李工' },
    { code: 'apr-0203', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-sea-ice', title: '海冰监测快照申请', requester: '吴敏', status: 'REJECTED', slaStatus: 'MET', createdAt: stamp(44), updatedAt: stamp(22), decisionBy: '李工', decisionNote: '密级材料不完整' },
    { code: 'apr-0204', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-night-light', title: '夜间灯光影像申请', requester: '张晓明', status: 'WITHDRAWN', slaStatus: 'NONE', createdAt: stamp(28), updatedAt: stamp(24) },
    { code: 'apr-0205', approvalType: 'SYSTEM_PERMISSION', sourceSystem: 'portal', sourceCode: 'role-data', title: '数据管理员角色申请', requester: '郑涛', status: 'PENDING', slaStatus: 'ON_TIME', createdAt: stamp(9), updatedAt: stamp(8) },
    { code: 'apr-0206', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-infrared-weak', title: '红外弱小目标序列申请', requester: 'alice', status: 'APPROVED', slaStatus: 'ON_TIME', createdAt: stamp(16), updatedAt: stamp(5), decisionBy: '陈晓' },
    { code: 'apr-0207', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-altimetry', title: '测高波形数据使用申请（今日到期待办）', requester: 'bob', status: 'PENDING', slaStatus: 'DUE_SOON', slaDeadline: relativeIso(-2), createdAt: stamp(22), updatedAt: stamp(3) },
    { code: 'apr-0208', approvalType: 'R4_TOOL_CALL', sourceSystem: 'mcp-gateway', sourceCode: 'cfm-track', title: '航迹关联工具开通申请', requester: '孙航', status: 'REJECTED', slaStatus: 'MET', createdAt: stamp(50), updatedAt: stamp(30), decisionBy: '李工' },
    { code: 'apr-0209', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-ndvi', title: '植被指数产品申请', requester: '周研', status: 'WITHDRAWN', slaStatus: 'NONE', createdAt: stamp(40), updatedAt: stamp(32) },
    { code: 'apr-0210', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-sar-wide', title: 'SAR 宽幅海面监测申请', requester: '王工', status: 'PENDING', slaStatus: 'OVERDUE', slaDeadline: stamp(12), createdAt: stamp(60), updatedAt: stamp(10) },
    { code: 'apr-0211', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-optical-archive', title: '高分光学历史归档申请', requester: '吴敏', status: 'APPROVED', slaStatus: 'MET', createdAt: stamp(54), updatedAt: stamp(20), decisionBy: '陈晓' },
    { code: 'apr-0212', approvalType: 'SYSTEM_PERMISSION', sourceSystem: 'portal', sourceCode: 'role-algo', title: '算法运营角色申请', requester: '张晓明', status: 'REJECTED', slaStatus: 'MISSED', createdAt: stamp(70), updatedAt: stamp(40), decisionBy: '李工' },
    { code: 'apr-0213', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-gaofen-optical', title: '高分光学补景申请', requester: '郑涛', status: 'PENDING', slaStatus: 'ON_TIME', createdAt: stamp(7), updatedAt: stamp(6) },
    { code: 'apr-0214', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-ship-track', title: '轨迹库续订申请', requester: '陈晓', status: 'APPROVED', slaStatus: 'MET', createdAt: stamp(18), updatedAt: stamp(4), decisionBy: '李工' },
  ]
}

export function createSeedRequirements(): RecordValue[] {
  const opticalProfile = {
    businessDomain: '遥感目标识别', dataObject: '高分辨率光学卫星影像', scope: '东海重点海域', granularity: '0.5 米空间分辨率', period: '近 6 个月', frequency: '按过境批次',
    fields: ['scene_id', 'acquisition_time', 'orbit_id', 'sensor_type', 'cloud_cover', 'image_uri'], useCase: '港区目标特性提取', sensitivity: 'INTERNAL',
  }
  return [
    { code: 'req-001', requirementType: 'COMPREHENSIVE', title: '海上目标态势研判场景', description: '整合光学影像、目标检测算法和海上目标本体规则。', requester: '陈晓', status: 'IN_PROGRESS', assigneeSystem: 'algorithm-recombine', assigneeRef: 'tpl-maritime-target-flow', createdAt: stamp(20), updatedAt: stamp(4) },
    { code: 'req-002', requirementType: 'DATA', title: '高分辨率光学影像目标特性提取', description: '申请东海重点海域高分光学卫星影像，用于港区舰船与设施目标特性提取。', requester: 'alice', status: 'OPEN', dataProfile: opticalProfile, createdAt: stamp(16), updatedAt: stamp(16) },
    { code: 'req-006', requirementType: 'DATA', title: '东海港区目标特性识别影像需求', description: '需要同海域同分辨率光学影像用于港区目标特性识别。', requester: 'bob', status: 'OPEN', dataProfile: opticalProfile, createdAt: stamp(15), updatedAt: stamp(15) },
    { code: 'req-003', requirementType: 'ALGORITHM', title: '红外弱小目标检测轨次处理', description: '将载荷红外影像接入弱小目标检测能力，形成轨次级处理结果。', requester: 'bob', status: 'ANALYZING', createdAt: stamp(22), updatedAt: stamp(10) },
    { code: 'req-004', requirementType: 'DATA', title: 'SAR海面目标检测辅助数据', description: '申请SAR影像及海况辅助要素，用于海面目标检测结果复核。', requester: '王工', status: 'ASSIGNED', assigneeSystem: 'data-platform', assigneeRef: 'ds-sar-maritime', createdAt: stamp(30), updatedAt: stamp(12) },
    { code: 'req-005', requirementType: 'COMPREHENSIVE', title: '卫星载荷效能评估看板', description: '汇总载荷工作状态、目标识别效果和轨次处理效能。', requester: '李工', status: 'COMPLETED', assigneeSystem: 'portal', closedNote: '载荷效能看板已上线并完成验收', createdAt: stamp(72), updatedAt: stamp(24) },
    { code: 'req-007', requirementType: 'DATA', title: '海表温度场航次保障需求', description: '为示范航次提供日更海表温度场。', requester: '周研', status: 'OPEN', createdAt: stamp(8), updatedAt: stamp(8) },
    { code: 'req-008', requirementType: 'ALGORITHM', title: '舰船航迹关联定制', description: '将光学与 SAR 轨迹做跨源关联。', requester: '孙航', status: 'ANALYZING', createdAt: stamp(18), updatedAt: stamp(9) },
    { code: 'req-009', requirementType: 'DATA', title: '夜间灯光港区活动监测', description: '申请沿岸港区夜间灯光周产品。', requester: '吴敏', status: 'ASSIGNED', assigneeSystem: 'data-platform', assigneeRef: 'ds-night-light', createdAt: stamp(26), updatedAt: stamp(11) },
    { code: 'req-010', requirementType: 'ALGORITHM', title: '港区变化检测例行任务', description: '对相邻过境光学影像做变化检测。', requester: '张晓明', status: 'IN_PROGRESS', assigneeSystem: 'algorithm-recombine', assigneeRef: 'cap-change-detect', createdAt: stamp(28), updatedAt: stamp(6) },
    { code: 'req-011', requirementType: 'DATA', title: '测高波形科研试用', description: '申请测高波形样本用于海况反演试验。', requester: '郑涛', status: 'COMPLETED', closedNote: '样本已投递', createdAt: stamp(80), updatedAt: stamp(36) },
    { code: 'req-012', requirementType: 'DATA', title: '植被指数沿岸对照', description: '申请 NDVI 产品做沿岸植被对照。', requester: '周研', status: 'CANCELED', closedNote: '与已有订阅重复，申请人撤回', createdAt: stamp(40), updatedAt: stamp(30) },
    { code: 'req-013', requirementType: 'ALGORITHM', title: '海况通报自动分类', description: '对值班通报做主题分类。', requester: 'alice', status: 'CANCELED', closedNote: '改走现有主题分类服务', createdAt: stamp(50), updatedAt: stamp(42) },
    { code: 'req-014', requirementType: 'COMPREHENSIVE', title: '海冰监测应急保障', description: '黄渤海秋季海冰加密监测与速报。', requester: '王工', status: 'IN_PROGRESS', assigneeSystem: 'data-platform', assigneeRef: 'ds-sea-ice', createdAt: stamp(14), updatedAt: stamp(3) },
    { code: 'req-015', requirementType: 'DATA', title: '光谱库扩容申请', description: '补充舰船甲板与港区设施光谱样本。', requester: '孙航', status: 'OPEN', createdAt: stamp(6), updatedAt: stamp(6) },
    { code: 'req-016', requirementType: 'ALGORITHM', title: '载荷遥测异常门限校准', description: '按换轨窗口重标定异常检测阈值。', requester: 'bob', status: 'ANALYZING', createdAt: stamp(11), updatedAt: stamp(7) },
    { code: 'req-017', requirementType: 'DATA', title: 'SAR 宽幅海面巡查', description: '申请宽幅 SAR 用于开阔海面巡查。', requester: '吴敏', status: 'ASSIGNED', assigneeSystem: 'data-platform', assigneeRef: 'ds-sar-wide', createdAt: stamp(19), updatedAt: stamp(8) },
    { code: 'req-018', requirementType: 'COMPREHENSIVE', title: '光学历史归档回放', description: '回放近三个月高分光学归档做复盘。', requester: '李工', status: 'COMPLETED', closedNote: '归档通道已开通', createdAt: stamp(64), updatedAt: stamp(20) },
  ]
}

export function createSeedTasks(): RecordValue[] {
  return [
    { taskId: 'tsk-run-001', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'RUNNING', stage: '执行节点 2/3', progress: 62, resourceRefs: ['tpl-maritime-target-flow@1', 'ds-gaofen-optical@v2026.09'], resultRefs: [], traceId: 'mock-trace-run-001', createdAt: stamp(2), updatedAt: stamp(1) },
    { taskId: 'tsk-import-002', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'SUCCESS', stage: '质量校验完成', progress: 100, resourceRefs: ['ds-sar-maritime@v1.4.2'], resultRefs: ['result-quality-002'], traceId: 'mock-trace-import-002', createdAt: stamp(28), updatedAt: stamp(27) },
    { taskId: 'tsk-run-003', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'SUCCESS', stage: '已完成', progress: 100, resourceRefs: ['cap-infrared-weak-target@2', 'ds-payload-telemetry@v2026.09.01'], resultRefs: ['result-anomaly-001'], traceId: 'mock-trace-run-003', createdAt: stamp(50), updatedAt: stamp(49) },
    { taskId: 'tsk-run-004', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'FAILED', stage: '预检未通过', progress: 0, resourceRefs: ['tpl-orbit-anomaly@1'], resultRefs: [], traceId: 'mock-trace-run-004', createdAt: stamp(74), updatedAt: stamp(74) },
    { taskId: 'tsk-import-005', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'SUCCESS', stage: '交付完成', progress: 100, resourceRefs: ['ds-payload-telemetry@v3.0.1'], resultRefs: ['result-payload-001'], traceId: 'mock-trace-import-005', createdAt: stamp(98), updatedAt: stamp(97) },
    { taskId: 'tsk-run-006', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'QUEUED', stage: '排队等待资源', progress: 0, resourceRefs: ['cap-change-detect@1'], resultRefs: [], createdAt: stamp(1), updatedAt: stamp(1) },
    { taskId: 'tsk-run-007', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'RUNNING', stage: '特征提取', progress: 40, resourceRefs: ['tpl-quality-weekly@1'], resultRefs: [], createdAt: stamp(3), updatedAt: stamp(1) },
    { taskId: 'tsk-run-008', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'SUCCESS', stage: '已完成', progress: 100, resourceRefs: ['cap-timeseries-forecast@1'], resultRefs: ['result-sst-001'], createdAt: stamp(40), updatedAt: stamp(36) },
    { taskId: 'tsk-run-009', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'CANCELLED', stage: '已取消', progress: 10, resourceRefs: ['cap-text-classify@1'], resultRefs: [], createdAt: stamp(60), updatedAt: stamp(58) },
    { taskId: 'tsk-import-010', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'SUCCESS', stage: '交付完成', progress: 100, resourceRefs: ['ds-sea-ice@1'], resultRefs: ['result-ice-001'], createdAt: stamp(26), updatedAt: stamp(24) },
    { taskId: 'tsk-run-011', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'FAILED', stage: '输入不兼容', progress: 0, resourceRefs: ['cap-track-associate@1'], resultRefs: [], createdAt: stamp(18), updatedAt: stamp(18) },
    { taskId: 'tsk-run-012', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'QUEUED', stage: '等待影像到齐', progress: 0, resourceRefs: ['cap-change-detect@1'], resultRefs: [], createdAt: stamp(5), updatedAt: stamp(5) },
    { taskId: 'tsk-import-013', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'RUNNING', stage: '质检中', progress: 55, resourceRefs: ['ds-night-light@1'], resultRefs: [], createdAt: stamp(4), updatedAt: stamp(2) },
    { taskId: 'tsk-run-014', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'SUCCESS', stage: '已完成', progress: 100, resourceRefs: ['cap-track-associate@1'], resultRefs: ['result-track-001'], createdAt: stamp(12), updatedAt: stamp(8) },
    { taskId: 'tsk-import-015', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'SUCCESS', stage: '交付完成', progress: 100, resourceRefs: ['ds-gaofen-optical@2.1.0'], resultRefs: ['result-optical-001'], createdAt: stamp(16), updatedAt: stamp(14) },
  ]
}

export function hydrateNotices(): RecordValue[] {
  return seedNotices.map((item) => ({
    ...item,
    publishedAt: item.publishedHoursAgo === undefined ? undefined : stamp(item.publishedHoursAgo),
    createdAt: stamp(item.createdHoursAgo),
    updatedAt: stamp(item.createdHoursAgo),
  }))
}

export function hydrateFeedbacks(): RecordValue[] {
  return seedFeedbacks.map((item) => ({
    ...item,
    createdAt: stamp(item.createdHoursAgo),
    updatedAt: stamp(item.createdHoursAgo),
  }))
}

export function hydrateNotifications(): RecordValue[] {
  return seedNotifications.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    resourceRef: item.resourceRef,
    createdAt: stamp(item.createdHoursAgo),
    readAt: item.readHoursAgo === undefined ? undefined : stamp(item.readHoursAgo),
  }))
}

export function hydrateResults(): RecordValue[] {
  return seedResults.map((item) => ({
    resultId: item.resultId,
    sourceSystem: item.sourceSystem,
    resultType: item.resultType,
    resourceRefs: item.resourceRefs,
    metadata: item.metadata,
    sourceTaskId: item.sourceTaskId,
    traceId: item.traceId,
    createdAt: stamp(item.createdHoursAgo),
    updatedAt: stamp(item.createdHoursAgo),
    hasFile: item.hasFile,
  }))
}

export function hydrateUsers(): RecordValue[] {
  return seedUsers.map((item) => ({ ...item }))
}
