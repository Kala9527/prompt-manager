export const promptElementDefinitions = [
  {
    key: 'role',
    label: '角色',
    hint: '模型需要扮演的身份、专业背景和工作视角',
    placeholder: '例如：资深产品经理、严谨的医学科普编辑、Vue 前端架构师',
  },
  {
    key: 'task',
    label: '任务',
    hint: '要完成的具体动作和交付内容',
    placeholder: '例如：为本地 AI 部署方案生成一份排障清单',
  },
  {
    key: 'background',
    label: '背景',
    hint: '上下文、对象、使用场景、已知信息',
    placeholder: '例如：面向公司内部运维人员，已有 FastAPI 文本生成服务',
  },
  {
    key: 'goal',
    label: '目标',
    hint: '希望输出达到的效果或判断标准',
    placeholder: '例如：让非算法背景人员也能快速定位问题',
  },
  {
    key: 'constraints',
    label: '约束条件',
    hint: '必须遵守的要求、边界、禁忌和优先级',
    placeholder: '每行写一条，例如：\n不要编造不存在的接口\n步骤必须可执行\n优先使用 Windows 命令',
  },
  {
    key: 'outputFormat',
    label: '输出格式',
    hint: '结构、字段、语言、长度和格式要求',
    placeholder: '例如：Markdown 表格 + 分步骤说明，总字数 800 字以内',
  },
  {
    key: 'referenceStandard',
    label: '参考标准',
    hint: '示例、风格、评价维度或质量标准',
    placeholder: '例如：语气专业直接，像成熟工程师写给同事的内部说明',
  },
] as const

export type PromptElementKey = (typeof promptElementDefinitions)[number]['key']

export type PromptElements = Record<PromptElementKey, string>

export interface ApiSettings {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export interface SavedPrompt {
  id: string
  title: string
  description: string
  elements: PromptElements
  generatedPrompt: string
  sourceDemand: string
  createdAt: string
  updatedAt: string
}

export interface PromptDraft {
  demand: string
  elements: PromptElements
  activePromptId: string
  saveTitle: string
  saveDescription: string
}

export interface PromptLibraryFile {
  version: 1
  prompts: SavedPrompt[]
  draft: PromptDraft
  updatedAt: string
}

export type NoticeType = 'idle' | 'success' | 'warning' | 'error' | 'info'

export interface NoticeState {
  type: NoticeType
  message: string
}

export function createEmptyElements(): PromptElements {
  return promptElementDefinitions.reduce((result, item) => {
    result[item.key] = ''
    return result
  }, {} as PromptElements)
}

export function createEmptyDraft(): PromptDraft {
  return {
    demand: '',
    elements: createEmptyElements(),
    activePromptId: '',
    saveTitle: '',
    saveDescription: '',
  }
}
