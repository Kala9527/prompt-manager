<script setup lang="ts">
import {
  ArrowRightLeft,
  BadgeCheck,
  Boxes,
  Braces,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Languages,
  Library,
  LoaderCircle,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from '@lucide/vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { promptElementDefinitions, type ApiSettings, type PromptElementKey } from '../types'
import {
  translateText,
  translationLanguages,
  translationSourceLanguages,
  type TranslationLanguageCode,
  type TranslationSourceLanguageCode,
} from '../services/translator'
import { usePromptStore } from '../stores/promptStore'

const store = usePromptStore()
const {
  activePromptId,
  apiSettings,
  completionPercent,
  demand,
  elements,
  fillingAll,
  fillingKey,
  generatedPrompt,
  libraryFileName,
  libraryLoading,
  notice,
  savedPrompts,
  saveDescription,
  saveTitle,
} = storeToRefs(store)

const fileInput = ref<HTMLInputElement | null>(null)
const copied = ref(false)
const settingsOpen = ref(false)
const libraryOpen = ref(false)
const translatorOpen = ref(false)
const translating = ref(false)
const translationCopied = ref(false)
const translationInput = ref('')
const translationOutput = ref('')
const translationSource = ref<TranslationSourceLanguageCode>('auto')
const translationTarget = ref<TranslationLanguageCode>('en')
const settingsDraft = reactive<ApiSettings>({ ...apiSettings.value })

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const promptLength = computed(() => generatedPrompt.value.length)
const filledCount = computed(
  () => promptElementDefinitions.filter((item) => clean(elements.value[item.key])).length,
)
const canUseApi = computed(
  () =>
    Boolean(demand.value.trim()) &&
    Boolean(apiSettings.value.baseUrl.trim()) &&
    Boolean(apiSettings.value.model.trim()),
)
const canTranslate = computed(
  () =>
    Boolean(translationInput.value.trim()) &&
    Boolean(apiSettings.value.baseUrl.trim()) &&
    Boolean(apiSettings.value.model.trim()) &&
    !translating.value,
)
const activeSavedPrompt = computed(() => savedPrompts.value.find((prompt) => prompt.id === activePromptId.value))

onMounted(() => {
  void store.initializePromptLibrary()
})

function updateDemand(event: Event) {
  store.setDemand((event.target as HTMLTextAreaElement).value)
}

function updateElement(key: PromptElementKey, event: Event) {
  store.setElement(key, (event.target as HTMLTextAreaElement).value)
}

function updateSaveTitle(event: Event) {
  store.setSaveTitle((event.target as HTMLInputElement).value)
}

function updateSaveDescription(event: Event) {
  store.setSaveDescription((event.target as HTMLTextAreaElement).value)
}

function openSettings() {
  Object.assign(settingsDraft, apiSettings.value)
  settingsOpen.value = true
}

function applySettings() {
  store.setApiSettings({ ...settingsDraft })
  settingsOpen.value = false
}

function openTranslator() {
  if (!translationInput.value.trim() && generatedPrompt.value.trim()) {
    translationInput.value = generatedPrompt.value
  }
  translatorOpen.value = true
}

function useGeneratedPromptForTranslation() {
  translationInput.value = generatedPrompt.value
}

function swapTranslationLanguages() {
  const source = translationSource.value
  translationSource.value = translationTarget.value
  translationTarget.value = source === 'auto' ? 'zh' : source

  if (translationOutput.value.trim()) {
    translationInput.value = translationOutput.value
    translationOutput.value = ''
  }
}

function clearTranslation() {
  translationInput.value = ''
  translationOutput.value = ''
}

async function runTranslation() {
  if (!translationInput.value.trim()) {
    store.setNotice('warning', '请输入要翻译的文本。')
    return
  }

  translating.value = true
  store.setNotice('info', '正在调用大模型翻译。')
  try {
    translationOutput.value = await translateText(
      translationInput.value,
      translationSource.value,
      translationTarget.value,
      apiSettings.value,
    )
    store.setNotice('success', '翻译完成。')
  } catch (error) {
    store.setNotice('error', error instanceof Error ? error.message : '翻译失败。')
  } finally {
    translating.value = false
  }
}

async function copyPrompt() {
  await navigator.clipboard.writeText(generatedPrompt.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

async function copyTranslation() {
  await navigator.clipboard.writeText(translationOutput.value)
  translationCopied.value = true
  window.setTimeout(() => {
    translationCopied.value = false
  }, 1600)
}

function pickImportFile() {
  fileInput.value?.click()
}

function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void store.importJsonFile(file)
    input.value = ''
  }
}

function loadSavedPrompt(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (id) {
    store.loadSavedPrompt(id)
  }
}

async function confirmDeleteSavedPrompt(id: string) {
  const prompt = savedPrompts.value.find((item) => item.id === id)
  if (!prompt) {
    store.setNotice('warning', '没有找到要删除的保存项。')
    return
  }

  if (!window.confirm(`确定删除「${prompt.title}」吗？此操作会从本地 JSON 文件中删除该保存项。`)) {
    return
  }

  await store.deleteSavedPrompt(id)
}

async function deleteActiveSavedPrompt() {
  if (!activePromptId.value) {
    store.setNotice('warning', '请先选择一个已保存提示词。')
    return
  }

  await confirmDeleteSavedPrompt(activePromptId.value)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <main class="workspace-shell">
    <header class="topbar brutal-slab">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 220 160" role="img">
            <rect x="15" y="24" width="118" height="84" class="svg-yellow" />
            <rect x="43" y="49" width="118" height="84" class="svg-cyan" />
            <path d="M39 118h122l22 26H66z" class="svg-black" />
            <path d="M58 66h62M58 84h44M58 102h76" class="svg-stroke" />
            <path d="M161 18l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" class="svg-pink" />
            <path d="M174 92h24v24h-24zM184 82v44M164 104h44" class="svg-stroke" />
          </svg>
        </div>
        <div>
          <p class="eyebrow">PROMPT FORGE</p>
          <h1>提示词管理工具</h1>
          <div class="status-strip">
            <span>{{ filledCount }}/7 元素</span>
            <span>{{ promptLength }} 字</span>
            <span>{{ savedPrompts.length }} 条保存</span>
          </div>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="hard-button pale-button" type="button" @click="openTranslator">
          <Languages :size="19" />
          翻译
        </button>
        <button class="hard-button pale-button" type="button" @click="libraryOpen = true">
          <Library :size="19" />
          词库
        </button>
        <button class="hard-button pale-button" type="button" @click="openSettings">
          <Settings2 :size="19" />
          API
        </button>
        <button class="hard-button pale-button" type="button" @click="store.resetDraft">
          <Plus :size="19" />
          新建
        </button>
        <button class="hard-button hot-button" type="button" :disabled="fillingAll || !canUseApi" @click="store.fillAll">
          <LoaderCircle v-if="fillingAll" class="spin" :size="19" />
          <WandSparkles v-else :size="19" />
          一键填充
        </button>
      </div>
    </header>

    <section v-if="notice.message" class="notice" :class="`notice-${notice.type}`">
      {{ notice.message }}
    </section>

    <section class="action-row">
      <label class="select-box">
        <span>已保存提示词</span>
        <select :value="activePromptId" @change="loadSavedPrompt">
          <option value="">选择一个保存项</option>
          <option v-for="prompt in savedPrompts" :key="prompt.id" :value="prompt.id">
            {{ prompt.title }} / {{ formatTime(prompt.updatedAt) }}
          </option>
        </select>
      </label>

      <button
        class="hard-button danger-button"
        type="button"
        :disabled="!activeSavedPrompt"
        @click="deleteActiveSavedPrompt"
      >
        <Trash2 :size="18" />
        删除
      </button>

      <div class="quick-cards" aria-hidden="true">
        <span><Boxes :size="16" /> 角色</span>
        <span><Braces :size="16" /> 约束</span>
        <span><FileText :size="16" /> 输出</span>
        <span><BadgeCheck :size="16" /> 标准</span>
      </div>
    </section>

    <section class="layout-grid">
      <section class="panel editor-panel">
        <div class="panel-header loud-header">
          <div>
            <p class="eyebrow">INPUT</p>
            <h2>需求与元素</h2>
          </div>
          <span class="meter">{{ completionPercent }}%</span>
        </div>

        <label class="field-block demand-block">
          <span>原始需求</span>
          <textarea
            :value="demand"
            rows="5"
            placeholder="只输入你的需求，也可以先写几句模糊想法，再用 API 填充 7 个元素。"
            @input="updateDemand"
          />
        </label>

        <div class="accordion-list">
          <details
            v-for="(item, index) in promptElementDefinitions"
            :key="item.key"
            class="element-fold"
            :open="index < 2"
          >
            <summary>
              <span class="fold-index">{{ index + 1 }}</span>
              <span class="fold-copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.hint }}</small>
              </span>
              <button
                class="icon-button fill-button"
                type="button"
                :disabled="fillingAll || fillingKey === item.key || !canUseApi"
                :title="`填充${item.label}`"
                @click.stop.prevent="store.fillOne(item.key)"
              >
                <LoaderCircle v-if="fillingKey === item.key" class="spin" :size="17" />
                <Sparkles v-else :size="17" />
              </button>
              <ChevronDown class="chevron" :size="20" />
            </summary>
            <textarea
              :value="elements[item.key]"
              :rows="item.key === 'constraints' ? 6 : 4"
              :placeholder="item.placeholder"
              @input="updateElement(item.key, $event)"
            />
          </details>
        </div>
      </section>

      <section class="panel preview-panel">
        <div class="panel-header loud-header cyan-header">
          <div>
            <p class="eyebrow">OUTPUT</p>
            <h2>标准化提示词</h2>
          </div>
          <button class="hard-button mini-button" type="button" @click="copyPrompt">
            <Copy :size="18" />
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>

        <pre class="prompt-preview">{{ generatedPrompt }}</pre>
      </section>

      <aside class="panel save-panel">
        <div class="panel-header loud-header pink-header">
          <div>
            <p class="eyebrow">SAVE</p>
            <h2>保存与管理</h2>
          </div>
          <PanelRightOpen :size="22" />
        </div>

        <div class="save-stack">
          <label class="field-block compact-field">
            <span>标题</span>
            <input :value="saveTitle" placeholder="例如：会议纪要生成提示词" @input="updateSaveTitle" />
          </label>
          <label class="field-block compact-field">
            <span>描述</span>
            <textarea
              :value="saveDescription"
              rows="4"
              placeholder="记录用途、适用场景或版本备注"
              @input="updateSaveDescription"
            />
          </label>
          <button class="hard-button save-button" type="button" @click="store.saveCurrentPrompt">
            <Save :size="19" />
            {{ activePromptId ? '更新保存' : '保存提示词' }}
          </button>
          <button class="hard-button pale-button full-button" type="button" @click="libraryOpen = true">
            <Library :size="18" />
            打开词库
          </button>
        </div>

        <div class="mini-stats">
          <span>JSON: {{ libraryFileName || '加载中' }}</span>
          <span>Model: {{ apiSettings.model }}</span>
        </div>
      </aside>
    </section>

    <Teleport to="body">
      <div v-if="settingsOpen" class="modal-backdrop" @click.self="settingsOpen = false">
        <section class="modal-card settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-header yellow-header">
            <div>
              <p class="eyebrow">MODEL</p>
              <h2 id="settings-title">API 配置</h2>
            </div>
            <button class="icon-button close-button" type="button" title="关闭" @click="settingsOpen = false">
              <X :size="19" />
            </button>
          </div>

          <div class="settings-grid">
            <label class="field-block">
              <span>Base URL</span>
              <input v-model="settingsDraft.baseUrl" placeholder="/local-llm/v1" />
            </label>
            <label class="field-block">
              <span>API Key</span>
              <input v-model="settingsDraft.apiKey" placeholder="test" />
            </label>
            <label class="field-block wide-field">
              <span>Model</span>
              <input v-model="settingsDraft.model" placeholder="deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B" />
            </label>
            <label class="field-block">
              <span>Temperature</span>
              <input v-model.number="settingsDraft.temperature" type="number" min="0" max="2" step="0.1" />
            </label>
            <label class="field-block">
              <span>Max Tokens</span>
              <input v-model.number="settingsDraft.maxTokens" type="number" min="256" max="8192" step="128" />
            </label>
          </div>

          <div class="modal-actions">
            <button class="hard-button pale-button" type="button" @click="settingsOpen = false">取消</button>
            <button class="hard-button hot-button" type="button" @click="applySettings">
              <RotateCcw :size="18" />
              应用配置
            </button>
          </div>
        </section>
      </div>

      <div v-if="translatorOpen" class="modal-backdrop" @click.self="translatorOpen = false">
        <section class="modal-card translator-modal" role="dialog" aria-modal="true" aria-labelledby="translator-title">
          <div class="modal-header green-header">
            <div>
              <p class="eyebrow">TRANSLATE</p>
              <h2 id="translator-title">中英日韩互译</h2>
            </div>
            <button class="icon-button close-button" type="button" title="关闭" @click="translatorOpen = false">
              <X :size="19" />
            </button>
          </div>

          <div class="translator-controls">
            <label class="field-block">
              <span>源语言</span>
              <select v-model="translationSource">
                <option v-for="language in translationSourceLanguages" :key="language.code" :value="language.code">
                  {{ language.label }}
                </option>
              </select>
            </label>
            <button
              class="icon-button swap-button"
              type="button"
              title="交换语言"
              :disabled="translating"
              @click="swapTranslationLanguages"
            >
              <ArrowRightLeft :size="18" />
            </button>
            <label class="field-block">
              <span>目标语言</span>
              <select v-model="translationTarget">
                <option v-for="language in translationLanguages" :key="language.code" :value="language.code">
                  {{ language.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="translator-grid">
            <label class="field-block translator-textarea">
              <span>原文</span>
              <textarea v-model="translationInput" rows="11" placeholder="输入中文、英文、日文或韩文文本" />
            </label>
            <label class="field-block translator-textarea">
              <span>译文</span>
              <textarea v-model="translationOutput" rows="11" placeholder="翻译结果会显示在这里" readonly />
            </label>
          </div>

          <div class="modal-actions translator-actions">
            <button
              class="hard-button pale-button"
              type="button"
              :disabled="!generatedPrompt.trim() || translating"
              @click="useGeneratedPromptForTranslation"
            >
              <FileText :size="18" />
              带入提示词
            </button>
            <button class="hard-button pale-button" type="button" :disabled="translating" @click="clearTranslation">
              <Trash2 :size="18" />
              清空
            </button>
            <button
              class="hard-button mini-button"
              type="button"
              :disabled="!translationOutput.trim()"
              @click="copyTranslation"
            >
              <Copy :size="18" />
              {{ translationCopied ? '已复制译文' : '复制译文' }}
            </button>
            <button class="hard-button hot-button" type="button" :disabled="!canTranslate" @click="runTranslation">
              <LoaderCircle v-if="translating" class="spin" :size="19" />
              <Languages v-else :size="19" />
              翻译
            </button>
          </div>
        </section>
      </div>

      <div v-if="libraryOpen" class="modal-backdrop" @click.self="libraryOpen = false">
        <section class="modal-card library-modal" role="dialog" aria-modal="true" aria-labelledby="library-title">
          <div class="modal-header cyan-header">
            <div>
              <p class="eyebrow">LIBRARY</p>
              <h2 id="library-title">提示词库</h2>
            </div>
            <button class="icon-button close-button" type="button" title="关闭" @click="libraryOpen = false">
              <X :size="19" />
            </button>
          </div>

          <div class="file-toolbar">
            <button
              class="hard-button pale-button"
              type="button"
              :disabled="libraryLoading"
              @click="store.initializePromptLibrary(true)"
            >
              <RotateCcw :size="17" />
              刷新
            </button>
            <button class="hard-button pale-button" type="button" @click="pickImportFile">
              <Upload :size="17" />
              导入
            </button>
            <button class="hard-button pale-button" type="button" @click="store.downloadJsonFile">
              <Download :size="17" />
              导出
            </button>
            <input ref="fileInput" class="hidden-input" type="file" accept="application/json,.json" @change="importFile" />
          </div>

          <p class="file-name">
            {{ libraryFileName ? `当前文件：${libraryFileName}` : '正在读取本地 JSON 文件' }}
          </p>

          <div class="saved-list">
            <article
              v-for="prompt in savedPrompts"
              :key="prompt.id"
              class="saved-item"
              :class="{ active: prompt.id === activePromptId }"
            >
              <button class="saved-main" type="button" @click="store.loadSavedPrompt(prompt.id)">
                <strong>{{ prompt.title }}</strong>
                <span>{{ prompt.description || '无描述' }}</span>
                <small>{{ formatTime(prompt.updatedAt) }}</small>
              </button>
              <button class="icon-button danger" type="button" title="删除" @click="confirmDeleteSavedPrompt(prompt.id)">
                <Trash2 :size="16" />
              </button>
            </article>
            <p v-if="savedPrompts.length === 0" class="empty-state">还没有保存的提示词。</p>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>
