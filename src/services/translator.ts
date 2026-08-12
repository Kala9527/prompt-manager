import type { ApiSettings } from '../types'
import { callChat } from './llmClient'

export type TranslationLanguageCode = 'zh' | 'en' | 'ja' | 'ko'
export type TranslationSourceLanguageCode = TranslationLanguageCode | 'auto'

export interface TranslationLanguage {
  code: TranslationLanguageCode
  label: string
  promptName: string
}

export interface TranslationSourceLanguage {
  code: TranslationSourceLanguageCode
  label: string
  promptName: string
}

export const translationLanguages: TranslationLanguage[] = [
  { code: 'zh', label: '中文', promptName: '简体中文' },
  { code: 'en', label: 'English', promptName: '英文' },
  { code: 'ja', label: '日本語', promptName: '日文' },
  { code: 'ko', label: '한국어', promptName: '韩文' },
]

export const translationSourceLanguages: TranslationSourceLanguage[] = [
  { code: 'auto', label: '自动识别', promptName: '自动识别' },
  ...translationLanguages,
]

function languageName(code: TranslationSourceLanguageCode): string {
  return translationSourceLanguages.find((item) => item.code === code)?.promptName ?? code
}

function targetLanguageName(code: TranslationLanguageCode): string {
  return translationLanguages.find((item) => item.code === code)?.promptName ?? code
}

function cleanTranslation(content: string): string {
  const trimmed = content.trim()
  const outerFence = trimmed.match(/^```(?:\w+)?\s*\n([\s\S]*?)\n```$/)
  const value = outerFence?.[1]?.trim() ?? trimmed

  return value.replace(/^(?:译文|翻译结果|Translation)\s*[:：]\s*/i, '').trim()
}

function systemPrompt(): string {
  return [
    '你是一个严谨的翻译引擎，只负责中文、英文、日文、韩文之间的互译。',
    '保持原文含义、语气、段落结构、Markdown、代码块、变量名、占位符和专有名词。',
    '不要添加标题、解释、注释、寒暄或额外内容，只输出译文。',
  ].join('\n')
}

function userPrompt(
  sourceLanguage: TranslationSourceLanguageCode,
  targetLanguage: TranslationLanguageCode,
  text: string,
): string {
  const sourceLine =
    sourceLanguage === 'auto'
      ? '源语言：请自动识别，仅限中文、英文、日文、韩文'
      : `源语言：${languageName(sourceLanguage)}`

  return `${sourceLine}
目标语言：${targetLanguageName(targetLanguage)}

待翻译文本：
${text.trim()}`
}

export async function translateText(
  text: string,
  sourceLanguage: TranslationSourceLanguageCode,
  targetLanguage: TranslationLanguageCode,
  settings: ApiSettings,
): Promise<string> {
  const content = await callChat(
    {
      ...settings,
      temperature: Math.min(settings.temperature, 0.3),
    },
    [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: userPrompt(sourceLanguage, targetLanguage, text) },
    ],
  )

  return cleanTranslation(content)
}
