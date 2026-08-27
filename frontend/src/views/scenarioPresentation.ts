import type { ScenarioPresentation } from '@/types/portal'

export const WIDGET_KINDS = ['TABLE', 'CHART', 'METRIC', 'REPORT_LINK'] as const

export type WidgetKind = (typeof WIDGET_KINDS)[number]

export interface FormWidgetItem {
  kind: WidgetKind
  bindingAlias: string
}

/** 绑定行里已填写的别名，供 widget 下拉与校验使用。 */
export function bindingAliasSet(bindings: { alias?: string }[]): Set<string> {
  return new Set(
    bindings
      .map((binding) => binding.alias?.trim())
      .filter((alias): alias is string => Boolean(alias)),
  )
}

/**
 * 组装可选展示配置。无入口视图且无组件时省略。
 * widget 别名必须指向已填写的 bindings[].alias，禁止手写 JSON。
 */
export function buildPresentation(
  entryView: string,
  widgets: FormWidgetItem[],
  aliases: Set<string>,
): ScenarioPresentation | undefined {
  const view = entryView.trim()
  const rows = widgets
    .map((widget) => ({
      kind: widget.kind,
      bindingAlias: widget.bindingAlias.trim(),
    }))
    .filter((widget) => widget.kind || widget.bindingAlias)

  if (!view && rows.length === 0) {
    return undefined
  }

  for (const widget of rows) {
    if (!widget.bindingAlias) {
      throw new Error('WIDGET_ALIAS_REQUIRED')
    }
    if (!aliases.has(widget.bindingAlias)) {
      throw new Error(`WIDGET_ALIAS_UNKNOWN:${widget.bindingAlias}`)
    }
  }

  return {
    entryView: view || undefined,
    widgets: rows.length > 0 ? rows : undefined,
  }
}
