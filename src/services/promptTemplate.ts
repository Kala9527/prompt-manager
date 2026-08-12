import { promptElementDefinitions, type PromptElements } from '../types'

const fallbackLabels: Record<keyof PromptElements, string> = {
  role: '【角色】',
  task: '【具体任务】',
  background: '【相关背景】',
  goal: '【希望达到的效果】',
  constraints: '【要求一】\n【要求二】\n【要求三】',
  outputFormat: '【格式、结构、字数】',
  referenceStandard: '【示例、风格或评价标准】',
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function valueOrFallback(elements: PromptElements, key: keyof PromptElements): string {
  return clean(elements[key]) || fallbackLabels[key]
}

function formatConstraints(value: unknown): string {
  const items = value
    ? clean(value)
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim())
    .filter(Boolean)
    : []

  const source = items.length > 0 ? items : fallbackLabels.constraints.split('\n')

  return source.map((item, index) => `${index + 1}. ${item}`).join('\n')
}

export function generateStandardPrompt(elements: PromptElements): string {
  return `你是一名${valueOrFallback(elements, 'role')}。

请完成以下任务：
${valueOrFallback(elements, 'task')}

背景信息：
${valueOrFallback(elements, 'background')}

目标：
${valueOrFallback(elements, 'goal')}

具体要求：
${formatConstraints(elements.constraints)}

输出格式：
${valueOrFallback(elements, 'outputFormat')}

参考标准：
${valueOrFallback(elements, 'referenceStandard')}

在输出前，请先检查是否满足以上所有要求。`
}

export function summarizeCompletion(elements: PromptElements): number {
  const filled = promptElementDefinitions.filter((item) => clean(elements[item.key])).length
  return Math.round((filled / promptElementDefinitions.length) * 100)
}
