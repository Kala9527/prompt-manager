import { defineStore } from 'pinia'
import {
  createEmptyDraft,
  createEmptyElements,
  type ApiSettings,
  type NoticeState,
  type PromptDraft,
  type PromptElementKey,
  type PromptElements,
  type PromptLibraryFile,
  type SavedPrompt,
} from '../types'
import { generateStandardPrompt, summarizeCompletion } from '../services/promptTemplate'
import { fillAllPromptElements, fillSinglePromptElement } from '../services/promptFill'
import {
  createLibraryFile,
  downloadLibraryFile,
  loadLocalLibraryFile,
  readImportedLibrary,
  writeLocalLibraryFile,
} from '../services/fileStorage'

interface CachedState {
  apiSettings?: Partial<ApiSettings>
  demand?: string
  elements?: Partial<PromptElements>
  savedPrompts?: SavedPrompt[]
  saveTitle?: string
  saveDescription?: string
  activePromptId?: string
}

type DraftInput = Omit<Partial<PromptDraft>, 'elements'> & {
  elements?: Partial<PromptElements>
}

type ApiSettingsInput = Partial<Record<keyof ApiSettings, unknown>>

interface PromptState extends PromptDraft {
  apiSettings: ApiSettings
  savedPrompts: SavedPrompt[]
  fillingAll: boolean
  fillingKey: PromptElementKey | ''
  notice: NoticeState
  libraryFileName: string
  libraryLoaded: boolean
  libraryLoading: boolean
}

const cacheKey = 'prompt-manager-state-v1'

const defaultApiSettings: ApiSettings = {
  baseUrl: __DEFAULT_OPENAI_BASE_URL__ || '/local-llm/v1',
  apiKey: 'test',
  model: __DEFAULT_OPENAI_MODEL__ || 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
  temperature: 0.2,
  maxTokens: 1400,
}

let libraryWriteQueue = Promise.resolve('')

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  return ''
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function chatEndpoint(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }

  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function sameChatEndpoint(left: string, right: string): boolean {
  const leftEndpoint = chatEndpoint(left)
  const rightEndpoint = chatEndpoint(right)
  if (!leftEndpoint || !rightEndpoint) {
    return false
  }

  try {
    return new URL(leftEndpoint, window.location.origin).href === new URL(rightEndpoint, window.location.origin).href
  } catch {
    return leftEndpoint === rightEndpoint
  }
}

function compatibleApiSettings(settings?: ApiSettingsInput): ApiSettings {
  const apiSettings = {
    baseUrl: coerceText(settings?.baseUrl) || defaultApiSettings.baseUrl,
    apiKey: settings && Object.hasOwn(settings, 'apiKey') ? coerceText(settings.apiKey) : defaultApiSettings.apiKey,
    model: coerceText(settings?.model) || defaultApiSettings.model,
    temperature: coerceNumber(settings?.temperature, defaultApiSettings.temperature),
    maxTokens: coerceNumber(settings?.maxTokens, defaultApiSettings.maxTokens),
  }

  if (sameChatEndpoint(apiSettings.baseUrl, __OPENAI_REMOTE_CHAT_COMPLETIONS_URL__)) {
    return { ...apiSettings, baseUrl: defaultApiSettings.baseUrl }
  }

  return apiSettings
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseCache(): CachedState | null {
  try {
    const cached = localStorage.getItem(cacheKey)
    return cached ? JSON.parse(cached) as CachedState : null
  } catch {
    return null
  }
}

function loadCachedApiSettings(): ApiSettings {
  return compatibleApiSettings(parseCache()?.apiSettings)
}

function persistApiSettings(apiSettings: ApiSettings): void {
  localStorage.setItem(cacheKey, JSON.stringify({ apiSettings }))
}

function normalizeDraft(draft?: DraftInput): PromptDraft {
  const elements = createEmptyElements()
  for (const item of Object.keys(elements) as PromptElementKey[]) {
    elements[item] = coerceText(draft?.elements?.[item])
  }

  return {
    demand: coerceText(draft?.demand),
    elements,
    activePromptId: coerceText(draft?.activePromptId),
    saveTitle: coerceText(draft?.saveTitle),
    saveDescription: coerceText(draft?.saveDescription),
  }
}

function hasDraftContent(draft: PromptDraft): boolean {
  return Boolean(
    draft.demand.trim() ||
      draft.activePromptId ||
      draft.saveTitle.trim() ||
      draft.saveDescription.trim() ||
      Object.values(draft.elements).some((value) => value.trim()),
  )
}

function loadLegacyLibraryFromCache(): PromptLibraryFile | null {
  const parsed = parseCache()
  if (!parsed) {
    return null
  }

  const prompts = Array.isArray(parsed.savedPrompts) ? parsed.savedPrompts : []
  const draft = normalizeDraft({
    demand: parsed.demand,
    elements: parsed.elements,
    activePromptId: parsed.activePromptId,
    saveTitle: parsed.saveTitle,
    saveDescription: parsed.saveDescription,
  })

  if (prompts.length === 0 && !hasDraftContent(draft)) {
    return null
  }

  return createLibraryFile(prompts, draft)
}

function mergeLegacyLibrary(library: PromptLibraryFile, legacy: PromptLibraryFile): PromptLibraryFile | null {
  const existingIds = new Set(library.prompts.map((prompt) => prompt.id))
  const legacyPrompts = legacy.prompts.filter((prompt) => !existingIds.has(prompt.id))
  const shouldUseLegacyDraft = !hasDraftContent(library.draft) && hasDraftContent(legacy.draft)

  if (legacyPrompts.length === 0 && !shouldUseLegacyDraft) {
    return null
  }

  return createLibraryFile(
    [...library.prompts, ...legacyPrompts],
    shouldUseLegacyDraft ? legacy.draft : library.draft,
  )
}

function currentDraft(state: PromptState): PromptDraft {
  return normalizeDraft({
    demand: state.demand,
    elements: state.elements,
    activePromptId: state.activePromptId,
    saveTitle: state.saveTitle,
    saveDescription: state.saveDescription,
  })
}

function enqueueLibraryWrite(library: PromptLibraryFile): Promise<string> {
  const nextWrite = libraryWriteQueue
    .catch(() => '')
    .then(() => writeLocalLibraryFile(library))

  libraryWriteQueue = nextWrite
  return nextWrite
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const usePromptStore = defineStore('prompt', {
  state: (): PromptState => ({
    ...createEmptyDraft(),
    apiSettings: loadCachedApiSettings(),
    savedPrompts: [],
    fillingAll: false,
    fillingKey: '',
    notice: { type: 'idle', message: '' },
    libraryFileName: '',
    libraryLoaded: false,
    libraryLoading: false,
  }),
  getters: {
    generatedPrompt: (state) => generateStandardPrompt(state.elements),
    completionPercent: (state) => summarizeCompletion(state.elements),
  },
  actions: {
    setNotice(type: NoticeState['type'], message: string) {
      this.notice = { type, message }
    },
    applyLibrary(library: PromptLibraryFile) {
      this.savedPrompts = library.prompts
      this.demand = library.draft.demand
      this.elements = { ...createEmptyElements(), ...library.draft.elements }
      this.activePromptId = library.draft.activePromptId
      this.saveTitle = library.draft.saveTitle
      this.saveDescription = library.draft.saveDescription
    },
    async initializePromptLibrary(force = false) {
      if (this.libraryLoading || (this.libraryLoaded && !force)) {
        return
      }

      this.libraryLoading = true
      try {
        const { library, fileName } = await loadLocalLibraryFile()
        const legacy = loadLegacyLibraryFromCache()
        const merged = legacy ? mergeLegacyLibrary(library, legacy) : null

        this.applyLibrary(merged ?? library)
        this.libraryFileName = fileName
        this.libraryLoaded = true

        if (merged) {
          await this.persistPromptLibrary()
          persistApiSettings(this.apiSettings)
          this.setNotice('success', `已将旧缓存迁移到 ${this.libraryFileName}。`)
          return
        }

        persistApiSettings(this.apiSettings)
        if (force) {
          this.setNotice('success', `已从 ${fileName} 重新读取提示词库。`)
        }
      } catch (error) {
        this.setNotice('error', errorMessage(error, '读取本地 JSON 文件失败。'))
      } finally {
        this.libraryLoading = false
      }
    },
    async persistPromptLibrary(): Promise<string> {
      const fileName = await enqueueLibraryWrite(createLibraryFile(this.savedPrompts, currentDraft(this.$state)))
      this.libraryFileName = fileName
      this.libraryLoaded = true
      return fileName
    },
    queuePromptLibraryPersist() {
      void this.persistPromptLibrary().catch((error) => {
        this.setNotice('error', errorMessage(error, '写入本地 JSON 文件失败。'))
      })
    },
    setDemand(value: string) {
      this.demand = value
      this.queuePromptLibraryPersist()
    },
    setElement(key: PromptElementKey, value: string) {
      this.elements[key] = value
      this.queuePromptLibraryPersist()
    },
    setApiSettings(settings: ApiSettings) {
      this.apiSettings = compatibleApiSettings(settings)
      persistApiSettings(this.apiSettings)
      this.setNotice('success', 'API 配置已保存到浏览器缓存。')
    },
    setSaveTitle(value: string) {
      this.saveTitle = value
      this.queuePromptLibraryPersist()
    },
    setSaveDescription(value: string) {
      this.saveDescription = value
      this.queuePromptLibraryPersist()
    },
    resetDraft() {
      this.demand = ''
      this.elements = createEmptyElements()
      this.activePromptId = ''
      this.saveTitle = ''
      this.saveDescription = ''
      this.queuePromptLibraryPersist()
      this.setNotice('info', '已新建空白提示词。')
    },
    async fillAll() {
      if (!this.demand.trim()) {
        this.setNotice('warning', '请先输入需求，再一键填充。')
        return
      }

      this.fillingAll = true
      this.setNotice('info', '正在调用 API 填充 7 个元素。')
      try {
        const result = await fillAllPromptElements(this.demand, this.elements, this.apiSettings)
        this.elements = { ...this.elements, ...result.elements }
        this.queuePromptLibraryPersist()
        const suffix =
          result.mode === 'single'
            ? 'JSON 两次解析失败，已改用逐项填充。'
            : '已通过结构化结果填充。'
        this.setNotice('success', suffix)
      } catch (error) {
        this.setNotice('error', errorMessage(error, 'API 调用失败。'))
      } finally {
        this.fillingAll = false
      }
    },
    async fillOne(key: PromptElementKey) {
      if (!this.demand.trim()) {
        this.setNotice('warning', '请先输入需求，再填充单个元素。')
        return
      }

      this.fillingKey = key
      this.setNotice('info', '正在调用 API 填充单个元素。')
      try {
        const value = await fillSinglePromptElement(key, this.demand, this.elements, this.apiSettings)
        this.elements[key] = value
        this.queuePromptLibraryPersist()
        this.setNotice('success', '元素已填充，可继续微调。')
      } catch (error) {
        this.setNotice('error', errorMessage(error, 'API 调用失败。'))
      } finally {
        this.fillingKey = ''
      }
    },
    async saveCurrentPrompt() {
      const title = this.saveTitle.trim()
      if (!title) {
        this.setNotice('warning', '请填写标题后保存。')
        return
      }

      const timestamp = nowIso()
      const existing = this.activePromptId
        ? this.savedPrompts.find((item) => item.id === this.activePromptId)
        : null
      const record: SavedPrompt = {
        id: existing?.id ?? crypto.randomUUID(),
        title,
        description: this.saveDescription.trim(),
        elements: { ...this.elements },
        generatedPrompt: generateStandardPrompt(this.elements),
        sourceDemand: this.demand.trim(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }

      if (existing) {
        this.savedPrompts = this.savedPrompts.map((item) => (item.id === record.id ? record : item))
      } else {
        this.savedPrompts = [record, ...this.savedPrompts]
      }

      this.activePromptId = record.id

      try {
        const fileName = await this.persistPromptLibrary()
        this.setNotice('success', `已保存到 ${fileName}。`)
      } catch (error) {
        this.setNotice('error', errorMessage(error, '保存到本地 JSON 文件失败。'))
      }
    },
    loadSavedPrompt(id: string) {
      const record = this.savedPrompts.find((item) => item.id === id)
      if (!record) {
        return
      }

      this.activePromptId = record.id
      this.saveTitle = record.title
      this.saveDescription = record.description
      this.demand = record.sourceDemand
      this.elements = { ...createEmptyElements(), ...record.elements }
      this.queuePromptLibraryPersist()
      this.setNotice('info', '已载入保存的提示词。')
    },
    async deleteSavedPrompt(id: string) {
      const existing = this.savedPrompts.find((item) => item.id === id)
      if (!existing) {
        this.setNotice('warning', '没有找到要删除的保存项。')
        return
      }

      this.savedPrompts = this.savedPrompts.filter((item) => item.id !== id)
      if (this.activePromptId === id) {
        this.activePromptId = ''
      }

      try {
        const fileName = await this.persistPromptLibrary()
        this.setNotice('success', `已从 ${fileName} 删除。`)
      } catch (error) {
        this.setNotice('error', errorMessage(error, '删除已在当前页面生效，但写入本地 JSON 文件失败。'))
      }
    },
    async importJsonFile(file: File) {
      try {
        const library = await readImportedLibrary(file)
        this.applyLibrary(library)
        const fileName = await this.persistPromptLibrary()
        this.setNotice('success', `JSON 文件已导入，并写入 ${fileName}。`)
      } catch (error) {
        this.setNotice('error', errorMessage(error, '导入 JSON 文件失败。'))
      }
    },
    downloadJsonFile() {
      downloadLibraryFile(createLibraryFile(this.savedPrompts, currentDraft(this.$state)))
      this.setNotice('success', '已导出 JSON 文件。')
    },
  },
})
