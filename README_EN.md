# Prompt Manager

[中文说明](./README.md)

A Vue 3 prompt workbench that turns raw ideas into structured prompts using seven elements: role, task, background, goal, constraints, output format, and reference standard. It can call an OpenAI-compatible LLM to fill prompt elements, save prompts to a local JSON library, import/export prompt collections, and translate between Chinese, English, Japanese, and Korean.

If you often write, revise, reuse, and organize prompts, this tool is meant to feel fast and practical. Stars, forks, issues, and workflow ideas are all welcome.

## Highlights

- Seven-element prompt template for structured prompt engineering.
- AI-assisted fill-all mode from a raw requirement.
- Per-element AI filling for iterative editing.
- Live standardized prompt preview with one-click copy.
- Local prompt library stored at runtime in `data/prompts-library.json`.
- Refresh, import, export, save, load, and delete prompt records.
- Legacy browser cache migration into the local JSON library.
- Chinese, English, Japanese, and Korean translation panel.
- Vite proxy for local or remote OpenAI-compatible APIs.
- API settings persistence in browser storage.

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Lucide Vue
- OpenAI-compatible Chat Completions API

## Quick Start

### 1. Install dependencies

```powershell
npm install
```

### 2. Start development server

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5180
```

Windows users can also run:

```powershell
.\start.bat
```

### 3. Configure model API

Click `API` in the top-right corner and configure:

```text
Base URL: /local-llm/v1
API Key: test
Model: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
```

The default proxy forwards `/local-llm/v1/chat/completions` to:

```text
http://127.0.0.1:8008/v1/chat/completions
```

You can also use other OpenAI-compatible services:

```text
https://api.openai.com/v1
https://api.deepseek.com
http://127.0.0.1:1234/v1
```

## Environment Variables

Create a local `.env` file or set environment variables:

```env
OPENAI_CHAT_COMPLETIONS_URL=http://127.0.0.1:8008/v1/chat/completions
OPENAI_API_KEY=test
```

Also supported:

```env
VITE_OPENAI_CHAT_COMPLETIONS_URL=http://127.0.0.1:8008/v1/chat/completions
VITE_OPENAI_API_KEY=test
OPENAI_BASE_URL=http://127.0.0.1:8008/v1
```

## Build and Preview

```powershell
npm run build
npm run preview
```

The build output is generated in `dist/` and should not be committed to the source repository.

## GitHub Upload Notes

Do not commit real API keys or private prompts. `data/prompts-library.json` is a local runtime library and is ignored by default. If you want to publish examples, use a separate sanitized sample file.

## GitHub Topics

`vue`, `typescript`, `vite`, `pinia`, `prompt-engineering`, `prompt-manager`, `llm`, `openai-compatible`, `translation`, `productivity`

## License

MIT License is recommended if you plan to publish this project as open source.
