import {
  createEmptyDraft,
  createEmptyElements,
  promptElementDefinitions,
  type PromptDraft,
  type PromptElements,
  type PromptLibraryFile,
  type SavedPrompt,
} from '../types'

const localLibraryEndpoint = '/prompt-library'
const fallbackLocalLibraryFileName = __PROMPT_LIBRARY_FILE_NAME__ || 'data/prompts-library.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return ''
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = coerceText(value).trim()
    if (text) {
      return text
    }
  }

  return ''
}

function firstLine(value: string): string {
  const line = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean) ?? ''

  return line.length > 48 ? `${line.slice(0, 48)}...` : line
}

function normalizeDate(value: unknown, fallback = new Date().toISOString()): string {
  const text = coerceText(value).trim()
  if (!text) {
    return fallback
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function createImportedId(index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `imported-${Date.now()}-${index + 1}`
}

function normalizeElements(elements?: unknown, fallback: PromptElements = createEmptyElements()): PromptElements {
  const normalized = { ...fallback }
  if (!isRecord(elements)) {
    return normalized
  }

  for (const item of promptElementDefinitions) {
    if (Object.hasOwn(elements, item.key)) {
      normalized[item.key] = coerceText(elements[item.key])
    }
  }

  return normalized
}

function hasElementsContent(elements: PromptElements): boolean {
  return Object.values(elements).some((value) => value.trim())
}

function normalizeDraft(draft?: unknown): PromptDraft {
  const record = isRecord(draft) ? draft : {}
  const topLevelElements = normalizeElements(record)

  return {
    demand: coerceText(record.demand),
    elements: normalizeElements(record.elements, topLevelElements),
    activePromptId: coerceText(record.activePromptId),
    saveTitle: coerceText(record.saveTitle),
    saveDescription: firstText(record.saveDescription, record.description),
  }
}

function looksLikePromptRecord(value: unknown): boolean {
  if (typeof value === 'string') {
    return Boolean(value.trim())
  }

  if (!isRecord(value)) {
    return false
  }

  return [
    'title',
    'name',
    'description',
    'desc',
    'generatedPrompt',
    'prompt',
    'content',
    'template',
    'text',
    'sourceDemand',
    'demand',
    'elements',
    ...promptElementDefinitions.map((item) => item.key),
  ].some((key) => Object.hasOwn(value, key))
}

function normalizeSavedPrompt(prompt: unknown, index: number): SavedPrompt {
  const record = isRecord(prompt) ? prompt : {}
  const rawPromptText = isRecord(prompt) ? '' : coerceText(prompt)
  const generatedPrompt = firstText(
    record.generatedPrompt,
    record.prompt,
    record.content,
    record.template,
    record.text,
    rawPromptText,
  )
  const sourceDemand = firstText(record.sourceDemand, record.demand, record.request, record.input)
  const topLevelElements = normalizeElements(record)
  const elements = normalizeElements(record.elements, topLevelElements)

  if (!hasElementsContent(elements) && generatedPrompt && !sourceDemand) {
    elements.task = generatedPrompt
  }

  const createdAt = normalizeDate(record.createdAt)

  return {
    id: firstText(record.id, record.uuid) || createImportedId(index),
    title: firstText(record.title, record.name, firstLine(generatedPrompt), firstLine(sourceDemand)) || `未命名提示词 ${index + 1}`,
    description: firstText(record.description, record.desc, record.remark, record.note),
    elements,
    generatedPrompt,
    sourceDemand,
    createdAt,
    updatedAt: normalizeDate(record.updatedAt, createdAt),
  }
}

function normalizeLibraryFile(parsed: unknown): PromptLibraryFile {
  const root = isRecord(parsed) ? parsed : {}
  let rawPrompts: unknown[] | null = null

  if (Array.isArray(parsed)) {
    rawPrompts = parsed
  } else if (Array.isArray(root.prompts)) {
    rawPrompts = root.prompts
  } else if (Array.isArray(root.savedPrompts)) {
    rawPrompts = root.savedPrompts
  } else if (looksLikePromptRecord(parsed)) {
    rawPrompts = [parsed]
  }

  const draftSource = isRecord(root.draft) ? root.draft : root
  const draft = normalizeDraft(draftSource)

  if (!rawPrompts) {
    throw new Error('JSON 文件缺少 prompts 数组，且无法识别为旧版提示词格式。')
  }

  return {
    version: 1,
    prompts: rawPrompts.map((prompt, index) => normalizeSavedPrompt(prompt, index)),
    draft,
    updatedAt: normalizeDate(root.updatedAt),
  }
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string } }
    return payload.error?.message || fallback
  } catch {
    return fallback
  }
}

export function createLibraryFile(prompts: SavedPrompt[], draft: PromptDraft = createEmptyDraft()): PromptLibraryFile {
  return {
    version: 1,
    prompts: prompts.map((prompt, index) => normalizeSavedPrompt(prompt, index)),
    draft: normalizeDraft(draft),
    updatedAt: new Date().toISOString(),
  }
}

export async function loadLocalLibraryFile(): Promise<{ library: PromptLibraryFile; fileName: string }> {
  const response = await fetch(localLibraryEndpoint, {
    headers: { accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, '读取本地 JSON 文件失败。'))
  }

  const payload = await response.json() as {
    fileName?: string
    library?: Partial<PromptLibraryFile>
  }

  return {
    library: normalizeLibraryFile(payload.library ?? {}),
    fileName: payload.fileName || fallbackLocalLibraryFileName,
  }
}

export async function writeLocalLibraryFile(library: PromptLibraryFile): Promise<string> {
  const response = await fetch(localLibraryEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(library),
  })

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, '写入本地 JSON 文件失败。'))
  }

  const payload = await response.json() as { fileName?: string }
  return payload.fileName || fallbackLocalLibraryFileName
}

export function parseLibraryJson(source: string): PromptLibraryFile {
  const parsed = JSON.parse(source) as unknown
  return normalizeLibraryFile(parsed)
}

export async function readImportedLibrary(file: File): Promise<PromptLibraryFile> {
  return parseLibraryJson(await file.text())
}

export function downloadLibraryFile(library: PromptLibraryFile): void {
  const blob = new Blob([JSON.stringify(library, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'prompts-library.json'
  link.click()
  URL.revokeObjectURL(url)
}
