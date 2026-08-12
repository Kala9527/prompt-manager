import {
  promptElementDefinitions,
  type ApiSettings,
  type PromptElementKey,
  type PromptElements,
} from '../types'
import { callChat } from './llmClient'

export interface FillResult {
  elements: Partial<PromptElements>
  mode: 'json' | 'single'
  jsonFailures: number
}

const elementCopy: Record<PromptElementKey, string> = {
  role: '适合模型扮演的专业身份、经验层级和工作视角。',
  task: '用户真正希望模型完成的具体任务，避免宽泛空话。',
  background: '与任务有关的上下文、对象、场景、已有资料和受众。',
  goal: '最终输出应该达成的效果、质量方向或业务结果。',
  constraints: '必须遵守的边界、禁忌、优先级和操作要求。多条要求用换行分隔。',
  outputFormat: '输出的结构、字段、长度、语言、格式或排版要求。',
  referenceStandard: '可参考的示例、风格、评价标准、质量门槛或对标对象。',
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function contextBlock(elements: PromptElements): string {
  const lines = promptElementDefinitions.map((item) => {
    const value = clean(elements[item.key]) || '未填写'
    return `${item.label}：${value}`
  })
  return lines.join('\n')
}

function jsonSystemPrompt(): string {
  return [
    '你是一个中文提示词架构师，负责把用户需求拆解为标准提示词模板的 7 个元素。',
    '你必须只返回一个 JSON 对象，不要返回 Markdown、代码块、解释文字或多余字段。',
    'JSON 对象必须包含这些字符串字段：role, task, background, goal, constraints, outputFormat, referenceStandard。',
    'constraints 字段内部用换行分隔 3 到 6 条具体要求。',
    '所有字段都要使用中文，内容具体、可执行、避免空泛。',
  ].join('\n')
}

function jsonUserPrompt(demand: string, elements: PromptElements): string {
  return `用户原始需求：
${clean(demand)}

当前已填写内容：
${contextBlock(elements)}

请补全或优化 7 个提示词元素。已有内容合理时可以保留并润色，空缺内容请根据用户需求推断。`
}

function singleSystemPrompt(): string {
  return [
    '你是一个中文提示词架构师。',
    '你只生成用户指定的一个提示词元素值。',
    '不要输出 JSON，不要输出 Markdown 表格，不要加标题，不要解释。',
    '如果元素是约束条件，请用换行分隔多条要求；其他元素输出一段精炼文本。',
  ].join('\n')
}

function singleUserPrompt(
  key: PromptElementKey,
  demand: string,
  elements: PromptElements,
): string {
  const definition = promptElementDefinitions.find((item) => item.key === key)

  return `用户原始需求：
${clean(demand)}

当前 7 个元素：
${contextBlock(elements)}

请只生成「${definition?.label ?? key}」这个元素。
该元素含义：${elementCopy[key]}

要求：具体、可执行、可直接放入提示词模板中。`
}

function extractJsonObject(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced?.[1] ?? content
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回 JSON 对象。')
  }

  return source.slice(start, end + 1)
}

function parseJsonElements(content: string): Partial<PromptElements> {
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>
  const result: Partial<PromptElements> = {}

  for (const item of promptElementDefinitions) {
    const value = parsed[item.key]
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`JSON 字段 ${item.key} 缺失或不是字符串。`)
    }
    result[item.key] = value.trim()
  }

  return result
}

function sanitizePlainText(content: string, key: PromptElementKey): string {
  const label = promptElementDefinitions.find((item) => item.key === key)?.label
  let value = content
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```(?:\w+)?/g, '').replace(/```/g, ''),
    )
    .trim()

  if (label) {
    value = value.replace(new RegExp(`^${label}[：:]\\s*`), '').trim()
  }

  return value.replace(/^["'“”]+|["'“”]+$/g, '').trim()
}

export async function fillSinglePromptElement(
  key: PromptElementKey,
  demand: string,
  elements: PromptElements,
  settings: ApiSettings,
): Promise<string> {
  const content = await callChat(settings, [
    { role: 'system', content: singleSystemPrompt() },
    { role: 'user', content: singleUserPrompt(key, demand, elements) },
  ])

  return sanitizePlainText(content, key)
}

async function fillIndividually(
  demand: string,
  elements: PromptElements,
  settings: ApiSettings,
): Promise<Partial<PromptElements>> {
  const result: Partial<PromptElements> = {}
  const working: PromptElements = { ...elements }

  for (const item of promptElementDefinitions) {
    const value = await fillSinglePromptElement(item.key, demand, working, settings)
    result[item.key] = value
    working[item.key] = value
  }

  return result
}

export async function fillAllPromptElements(
  demand: string,
  elements: PromptElements,
  settings: ApiSettings,
): Promise<FillResult> {
  let jsonFailures = 0

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const content = await callChat(settings, [
      { role: 'system', content: jsonSystemPrompt() },
      { role: 'user', content: jsonUserPrompt(demand, elements) },
    ])

    try {
      return {
        elements: parseJsonElements(content),
        mode: 'json',
        jsonFailures,
      }
    } catch {
      jsonFailures += 1
    }
  }

  return {
    elements: await fillIndividually(demand, elements, settings),
    mode: 'single',
    jsonFailures,
  }
}
