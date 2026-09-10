import type { AssistantTemplate } from '../types'

/** 算法咨询/运行：命中即推荐算法卡；出现运行/提交动词时附带运行确认卡。 */
export const algorithmTemplate: AssistantTemplate = {
  id: 'algo-run',
  match: {
    keywords: ['算法', '跑一遍', '跑', '分析', '预测', '异常检测', '变化检测', '目标特性', '质量分析', '推荐算法'],
    patterns: [/推荐.*(算法|分析)/, /(提交|运行).*(算法|工作流|分析)/],
  },
  samples: ['帮我推荐一个做海表温度分析的算法', '跑一遍港区目标特性提取', '用载荷遥测趋势预测分析一下'],
  compose: (ctx) => {
    const hits = ctx.searchAlgorithms(ctx.question).slice(0, 2)
    const wantsRun = /提交|跑|运行|执行/.test(ctx.question)
    const primary = hits[0]
    return {
      text: hits.length
        ? wantsRun
          ? `匹配到 ${hits.length} 个可运行的算法，确认后将提交到算法工作台运行。`
          : `匹配到 ${hits.length} 个适用算法，可进入工作台查看输入要求后运行：`
        : '没有直接匹配的算法。可以换个说法描述分析目标，或到算法工作台浏览已发布目录。',
      cards: hits.map((algo) => ({ type: 'algorithm' as const, payload: algo })),
      citations: [{ source: 'algorithm-recombine', version: 'catalog-v1' }],
      actions: [
        { label: '去算法工作台', kind: 'navigate', target: '/algorithm-workbench' },
        { label: '登记算法需求', kind: 'navigate', target: '/personal/requirements' },
      ],
      confirm:
        wantsRun && primary
          ? {
              confirmToken: `cft-assistant-run-${primary.code}`,
              tool: 'recombine.submit_workflow',
              riskLevel: 'R4',
              summary: {
                code: primary.code,
                plan: `提交「${primary.name}」运行任务`,
                impact: '将创建运行任务并按风险等级进入审批',
              },
              argumentsSummary: JSON.stringify({ templateCode: primary.code }),
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
            }
          : undefined,
      // 运行确认沿用既有样板审批单：确认卡批准/拒绝走 apr-r4-sample 审批联动。
      approvalCode: wantsRun && primary ? 'apr-r4-sample' : undefined,
      quickReplies: hits.length ? ['第一个怎么运行？', '看它的输入要求', '换个目标再推荐'] : ['看今日待办', '报一条定制需求'],
    }
  },
}
