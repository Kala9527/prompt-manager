import type { ApiSettings } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function endpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }

  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function shouldUseDynamicProxy(requestUrl: string): boolean {
  try {
    const url = new URL(requestUrl, window.location.origin)
    if (url.origin === window.location.origin) {
      return false
    }

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function stripThinking(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

export async function callChat(settings: ApiSettings, messages: ChatMessage[]): Promise<string> {
  const requestUrl = endpoint(settings.baseUrl)
  if (!requestUrl) {
    throw new Error('Please configure the API URL first.')
  }

  const useDynamicProxy = shouldUseDynamicProxy(requestUrl)
  const fetchUrl = useDynamicProxy ? __OPENAI_DYNAMIC_PROXY_CHAT_COMPLETIONS_URL__ : requestUrl
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (useDynamicProxy) {
    headers['X-OpenAI-Target-URL'] = requestUrl
  }

  if (settings.apiKey.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`
  }

  let response: Response
  try {
    response = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model.trim(),
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: false,
      }),
    })
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : ''
    throw new Error(
      `API request failed${detail}. If this is a LAN or cross-origin endpoint, use /local-llm/v1 or /local-llm/v1/chat/completions so the Vite proxy can forward it.`,
    )
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload?.error?.message || payload?.message || `API request failed, HTTP ${response.status}`
    throw new Error(message)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('API returned an empty response. Could not read choices[0].message.content.')
  }

  return stripThinking(content)
}
