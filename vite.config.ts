import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const proxyPrefix = '/local-llm'
const dynamicProxyPath = '/openai-proxy/chat/completions'
const promptLibraryPath = '/prompt-library'
const promptLibraryFile = 'data/prompts-library.json'
const fallbackChatCompletionsUrl = 'http://127.0.0.1:8008/v1/chat/completions'
const fallbackModel = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B'

function cleanConfigValue(value?: string): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return ''
  }

  const unquoted = trimmed.replace(/^['"]|['"]$/g, '')
  const markdownLink = unquoted.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
  const candidate = markdownLink?.[2] ?? markdownLink?.[1] ?? unquoted
  const angleWrapped = candidate.match(/^<(.+)>$/)
  return (angleWrapped?.[1] ?? candidate).trim()
}

function pickConfigValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const cleaned = cleanConfigValue(value)
    if (cleaned) {
      return cleaned
    }
  }

  return ''
}

function normalizeChatCompletionsUrl(value?: string): URL {
  try {
    const url = new URL(cleanConfigValue(value) || fallbackChatCompletionsUrl)
    const pathname = url.pathname.replace(/\/+$/, '')
    url.pathname = pathname.endsWith('/chat/completions')
      ? pathname
      : `${pathname}/chat/completions`
    url.search = ''
    url.hash = ''
    return url
  } catch {
    return new URL(fallbackChatCompletionsUrl)
  }
}

function basePathFromChatCompletions(pathname: string): string {
  return pathname.replace(/\/chat\/completions\/?$/, '')
}

function headerValue(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }

  return typeof value === 'string' ? value : ''
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: any, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function emptyPromptLibrary() {
  return {
    version: 1,
    prompts: [],
    draft: {
      demand: '',
      elements: {
        role: '',
        task: '',
        background: '',
        goal: '',
        constraints: '',
        outputFormat: '',
        referenceStandard: '',
      },
      activePromptId: '',
      saveTitle: '',
      saveDescription: '',
    },
    updatedAt: new Date().toISOString(),
  }
}

function ensurePromptLibraryFile(root: string): string {
  const absolutePath = resolve(root, promptLibraryFile)
  mkdirSync(dirname(absolutePath), { recursive: true })

  if (!existsSync(absolutePath)) {
    writeFileSync(absolutePath, `${JSON.stringify(emptyPromptLibrary(), null, 2)}\n`, 'utf8')
  }

  return absolutePath
}

function promptLibraryStorage(): Plugin {
  let root = process.cwd()
  let absolutePath = ''

  async function handler(req: any, res: any) {
    const fileName = relative(root, absolutePath).replace(/\\/g, '/')

    try {
      if (req.method === 'GET') {
        const source = readFileSync(absolutePath, 'utf8')
        sendJson(res, 200, { fileName, library: JSON.parse(source) })
        return
      }

      if (req.method === 'POST') {
        const body = await readBody(req)
        const parsed = JSON.parse(body)
        writeFileSync(absolutePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
        sendJson(res, 200, { fileName })
        return
      }

      sendJson(res, 405, { error: { message: 'Unsupported prompt library method.' } })
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Unknown prompt library error'
      sendJson(res, 500, { error: { message: `Prompt library request failed: ${message}` } })
    }
  }

  return {
    name: 'prompt-library-storage',
    configResolved(config) {
      root = config.root
      absolutePath = ensurePromptLibraryFile(root)
    },
    configureServer(server) {
      server.middlewares.use(promptLibraryPath, handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(promptLibraryPath, handler)
    },
  }
}

function openAiDynamicProxy(defaultTarget: URL, authorization: string): Plugin {
  async function handler(req: any, res: any, next: () => void) {
    if (req.method !== 'POST') {
      next()
      return
    }

    const headerTarget = headerValue(req.headers['x-openai-target-url'])
    const targetUrl = normalizeChatCompletionsUrl(headerTarget || defaultTarget.toString())
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      sendJson(res, 400, { error: { message: 'Unsupported API URL protocol.' } })
      return
    }

    try {
      const body = await readBody(req)
      const incomingAuthorization = headerValue(req.headers.authorization)
      const headers: Record<string, string> = {
        'content-type': headerValue(req.headers['content-type']) || 'application/json',
      }

      if (authorization || incomingAuthorization) {
        headers.authorization = authorization || incomingAuthorization
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body,
      })
      const text = await response.text()

      res.statusCode = response.status
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase()
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
          res.setHeader(key, value)
        }
      })
      res.end(text)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Unknown proxy error'
      sendJson(res, 502, { error: { message: `Proxy request failed: ${message}` } })
    }
  }

  return {
    name: 'openai-dynamic-proxy',
    configureServer(server) {
      server.middlewares.use(dynamicProxyPath, handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(dynamicProxyPath, handler)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const chatCompletionsUrl = normalizeChatCompletionsUrl(
    pickConfigValue(
      env.OPENAI_CHAT_COMPLETIONS_URL,
      env.VITE_OPENAI_CHAT_COMPLETIONS_URL,
      env.OPENAI_BASE_URL,
      fallbackChatCompletionsUrl,
    ),
  )
  const apiKey = pickConfigValue(
    env.OPENAI_API_KEY,
    env.PENAI_API_KEY,
    env.VITE_OPENAI_API_KEY,
    env.VITE_PENAI_API_KEY,
  )
  const defaultBaseUrl = `${proxyPrefix}${basePathFromChatCompletions(chatCompletionsUrl.pathname)}`
  const authorization = apiKey ? `Bearer ${apiKey}` : ''
  const proxy = {
    [proxyPrefix]: {
      target: chatCompletionsUrl.origin,
      changeOrigin: true,
      ...(authorization ? { headers: { authorization } } : {}),
      rewrite: (path: string) => {
        const rewritten = path.replace(/^\/local-llm/, '')
        return rewritten === '/chat/completions' || !rewritten ? chatCompletionsUrl.pathname : rewritten
      },
    },
  }

  return {
    plugins: [vue(), openAiDynamicProxy(chatCompletionsUrl, authorization), promptLibraryStorage()],
    define: {
      __DEFAULT_OPENAI_BASE_URL__: JSON.stringify(defaultBaseUrl),
      __DEFAULT_OPENAI_MODEL__: JSON.stringify(fallbackModel),
      __OPENAI_REMOTE_CHAT_COMPLETIONS_URL__: JSON.stringify(chatCompletionsUrl.toString()),
      __OPENAI_PROXY_CHAT_COMPLETIONS_URL__: JSON.stringify(
        `${defaultBaseUrl}/chat/completions`.replace(/\/{2,}/g, '/'),
      ),
      __OPENAI_DYNAMIC_PROXY_CHAT_COMPLETIONS_URL__: JSON.stringify(dynamicProxyPath),
      __PROMPT_LIBRARY_FILE_NAME__: JSON.stringify(promptLibraryFile),
    },
    server: {
      host: '127.0.0.1',
      port: 5180,
      strictPort: true,
      proxy,
    },
    preview: {
      proxy,
    },
  }
})
