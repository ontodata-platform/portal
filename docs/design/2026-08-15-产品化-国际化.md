# M5 产品化：国际化基础（zh-CN/en-US 双语言界面）

日期：2026-08-15

状态：设计记录（M5 国际化落地完成——门户全部八页 + 布局双语言界面，
语言切换即时生效并持久化；日期/时间随语言本地化）

仓库：`wpp/ontodata/portal`（frontend）

## 1. 目标

英文界面可用：所有界面文案经消息目录渲染，语言即时切换并持久化；后端错误详情
（协议 message/traceId）仍按后端原文透传——错误对账不因翻译失真。

## 2. 设计

- **依赖**：vue-i18n 11（组合式模式，legacy:false，Vue3.5 适配）；
- **消息目录** `src/i18n/messages.ts`：`zhCn`（缺省）与 `enUs` 两份目录，
  `enUs: MessageSchema`（`typeof zhCn`）标注类型——**中英文键结构不一致在
  vue-tsc 编译期直接报错**，防止界面半英文化（运行时另有键一致性测试兜底）；
- **实例** `src/i18n/index.ts`：语言持久化 localStorage（`ontodata.locale`），
  缺省 zh-CN，非法取值回退 zh-CN；切换时同步 `document.documentElement.lang`
  （无障碍与浏览器行为）；
- **语言切换器**：`MainLayout` 头部（中文/English），切换即时生效；
- **标题与菜单**：路由 `meta.titleKey` 指向 `menu.*` 键，标题随语言切换；
- **状态码与协议值**：状态展示（DRAFT/PUBLISHED/…）按语言翻译展示，但传输与
  断言仍用后端协议编码（不改协议）；
- **翻译范围**：布局与菜单 + 全部八页（门户运营/数据商城/算法工作台/统一任务中心/
  审批中心/结果中心/需求管理/个人中心）均已完整英文化；状态码与类型码（DRAFT/
  PENDING/OPEN/…）传输仍用后端协议编码，仅展示层按语言翻译（不改协议）；
- **日期/时间本地化**：任务/结果更新时间按当前界面语言 `toLocaleString(locale)` 渲染
  （替换原 zh-CN 硬编码）。

## 3. 验收

- vitest：中英文键结构一致、缺省语言、切换即时生效、非法语言回退、插值消息；
- MainLayout 测试：切换 English 后菜单/标题/租户标签即时变英文并持久化；
- 全部视图测试在缺省 zh-CN 下通过（断言中文文案不受影响）；type-check 以
  `MessageSchema` 类型强制两目录键结构一致（编译期门禁）。

## 4. 后续

- 后端错误 message 国际化协议（错误码 + 参数化，前端按 code 翻译）——当前保持中文原文；
- 各软件 UI（data-platform/transform/recombine）按门户模式同构接入。
