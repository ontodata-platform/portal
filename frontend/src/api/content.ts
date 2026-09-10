/**
 * 门户内容聚合 API（B1 首页）。
 *
 * 契约（后端 T2-2 内容运营 CMS 落地时实现）：
 *   GET /api/v1/content/home
 *   → HomeData
 * 公告来自内容运营已发布数据，entries 为运营配置的首页推荐位，
 * todo 为跨域（审批/任务/需求/通知）待办聚合，均按当前租户与身份过滤。
 */
import { client } from './client'

import type { HomeData } from '@/types/portal'

export const contentApi = {
  async getHomeData(): Promise<HomeData> {
    const response = await client.get<HomeData>('/content/home')
    return response.data
  },
}
