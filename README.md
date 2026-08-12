# 提示词管理工具

[English](./README_EN.md)

一个基于 Vue 3 的提示词工作台，用“角色、任务、背景、目标、约束条件、输出格式、参考标准”七个元素把零散需求整理成结构化提示词。它支持调用 OpenAI 兼容大模型一键填充元素、保存本地 JSON 词库、导入导出提示词，并提供中文、英文、日文、韩文互译。

如果你经常写提示词、改提示词、找以前写过的提示词，这个工具会很顺手。欢迎 Star、Fork、提建议，也欢迎把你的提示词管理习惯一起带进来，让它变成更适合创作者和开发者的 Prompt 工作台。

## 功能亮点

- 七要素提示词模板：把需求拆成角色、任务、背景、目标、约束、输出格式和参考标准。
- 一键 AI 填充：输入原始需求后，可调用 OpenAI 兼容接口自动补全 7 个元素。
- 单项补全：每个元素都能单独调用模型补齐，适合边写边调。
- 实时预览：自动生成标准化提示词，可一键复制。
- 本地词库：提示词保存到 `data/prompts-library.json`，支持刷新、导入、导出和删除。
- 旧缓存迁移：会把浏览器旧缓存迁移到本地 JSON 词库。
- 中英日韩互译：内置翻译弹窗，支持自动识别源语言。
- 接口代理：Vite 内置本地代理，方便连接本地或远程 OpenAI 兼容接口，减少跨域困扰。
- API 配置持久化：Base URL、API Key、模型名等会保存在浏览器缓存中。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Lucide Vue
- OpenAI-compatible Chat Completions API

## 快速开始

### 1. 安装依赖

```powershell
npm install
```

### 2. 启动开发服务

```powershell
npm run dev
```

默认访问：

```text
http://127.0.0.1:5180
```

也可以直接运行 Windows 脚本：

```powershell
.\start.bat
```

### 3. 配置模型接口

页面右上角点击 `API`，填写：

```text
Base URL: /local-llm/v1
API Key: test
Model: deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
```

默认代理会把 `/local-llm/v1/chat/completions` 转发到本地：

```text
http://127.0.0.1:8008/v1/chat/completions
```

如果你使用其他 OpenAI 兼容服务，也可以直接填写服务地址，例如：

```text
https://api.openai.com/v1
https://api.deepseek.com
http://127.0.0.1:1234/v1
```

## 环境变量

可通过 `.env` 或启动环境覆盖默认模型配置：

```env
OPENAI_CHAT_COMPLETIONS_URL=http://127.0.0.1:8008/v1/chat/completions
OPENAI_API_KEY=test
```

也兼容：

```env
VITE_OPENAI_CHAT_COMPLETIONS_URL=http://127.0.0.1:8008/v1/chat/completions
VITE_OPENAI_API_KEY=test
OPENAI_BASE_URL=http://127.0.0.1:8008/v1
```

## 构建与预览

```powershell
npm run build
npm run preview
```

构建产物会生成在 `dist/`，上传源码仓库时建议不要提交。

## 项目结构

```text
prompt-manager/
├─ data/
│  └─ prompts-library.json      # 运行时自动创建的本地提示词库，默认不提交
├─ public/
├─ src/
│  ├─ components/
│  │  └─ PromptWorkbench.vue
│  ├─ services/
│  │  ├─ fileStorage.ts
│  │  ├─ llmClient.ts
│  │  ├─ promptFill.ts
│  │  ├─ promptTemplate.ts
│  │  └─ translator.ts
│  ├─ stores/
│  │  └─ promptStore.ts
│  ├─ App.vue
│  ├─ main.ts
│  └─ style.css
├─ package.json
├─ vite.config.ts
└─ README.md
```

## 上传 GitHub 前建议

本项目已经有 `.gitignore`，会排除：

- `node_modules/`
- `dist/`
- `*.log`
- `.env`
- IDE 缓存

请不要提交真实 API Key。`data/prompts-library.json` 是你的本地提示词库，默认已被忽略；如果要提供示例，请另建脱敏示例文件并确认没有私密提示词、客户信息或内部资料。

## GitHub Topics 建议

`vue`, `typescript`, `vite`, `pinia`, `prompt-engineering`, `prompt-manager`, `llm`, `openai-compatible`, `translation`, `productivity`

## License

如果你准备开源，建议选择 MIT License。这个项目很适合作为个人 AI 工作流工具持续迭代，越多人使用，越容易沉淀出好用的提示词范式。
