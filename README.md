# Unexposed / 未显影

> **把照片封存成胶卷，让今天的解释在未来重新显影。**

[![在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-APP-2545FF)](https://unexposed-memory.windy-betta-8990.chatgpt.site)
[![演示视频](https://img.shields.io/badge/%E6%BC%94%E7%A4%BA%E8%A7%86%E9%A2%91-MP4-d6442e)](./deliverables/UNEXPOSED-demo.mp4)
[![License: MIT](https://img.shields.io/badge/License-MIT-8d76a8)](./LICENSE)
![Topic: shenicest-fission](https://img.shields.io/badge/Topic-shenicest__fission-5C6BB0)

Unexposed 是一款本地优先的个人影像记忆应用。它不鼓励用户无限囤积照片，而是要求每卷只选择 **3 张**，为它们留下当下的说明并完成一次有仪式感的封存。未来再次打开胶卷时，用户可以重新回答“它现在对我意味着什么”，让同一张照片保留多个时间版本；也可以进入 AI“闪回”对话，从照片、旧说明和用户的叙述中继续追问，最终把有价值的内容写回照片。

**核心闭环：** 创建胶卷（恰好三张照片）→ 写下当下解释 → 封存为不可覆盖的历史版本 → 时间过去 → 重新显影 / AI 闪回追问 → 有价值的理解写回照片。

| 胶卷桌面 | 闪回对话 · 多声部争执 | 对话归档 |
|---|---|---|
| ![胶卷桌面](./screenshots/desk.webp) | ![闪回对话](./screenshots/flashback.webp) | ![对话归档](./screenshots/archive.webp) |

![Unexposed 主海报](./poster-mind.webp)

## 参赛提交信息

- **赛道：** 软件应用赛道——滴水穿石
- **作品名称：** Unexposed / 未显影
- **Slogan：** 把照片封存成胶卷，让今天的解释在未来重新显影。
- **GitHub 仓库：** https://github.com/2073147963-bit/Unexposed
- **Topic：** `shenicest-fission`
- **在线体验：** https://unexposed-memory.windy-betta-8990.chatgpt.site
- **演示视频：** [`deliverables/UNEXPOSED-demo.mp4`](./deliverables/UNEXPOSED-demo.mp4)（3 分 03 秒，1080p）
- **团队成员与分工：** 待补充（单人参赛）

## 作品描述

手机让拍照几乎没有成本，却让“为什么留下这张照片”越来越容易丢失。相册擅长按时间、地点和人物整理已经拍到的内容，却很少保存拍摄者当时的选择、解释和后来发生的变化。

Unexposed 用胶卷隐喻把记忆产品变成一条克制的闭环：创建一卷胶卷，挑选恰好三张照片，为每张照片写下或说出当下的解释，确认后封存；之后再通过“重新显影”和“闪回对话”添加新版本。原始记录不被覆盖，新的理解以时间层叠加，从而保留“那时”和“现在”的差异。

产品当前已经实现可运行、可体验的原型，而不是仅有界面展示：照片、说明、胶卷版本、反思和对话均可保存在当前浏览器；核心封存流程不依赖 AI，模型不可用时仍可创建、查看和重新显影胶卷。

## 目标用户与真实场景

- 照片很多、但很少回看或整理的人，希望用低频、低负担的方式留下真正重要的片段。
- 经常担任拍摄者、自己反而很少出现在画面中的家庭记录者。
- 希望保存父母、伴侣或朋友口述记忆的人，但不希望家人学习复杂的数字档案工具。
- 想观察同一段经历在多年后如何被重新理解的人。

典型使用场景：用户从一次旅行或一段关系中选择三张照片，写下当时的理由并封存；数月后再次打开，回答系统提出的问题，形成并列的 Then / Now 记录，而不是用今天的说法覆盖过去。

## 核心体验

1. **创建胶卷**：填写标题并选择主题，系统持续保存草稿。
2. **Exactly 3**：拖入或选择图片，只保留三张，可替换、删除和调整顺序。
3. **留下语境**：为每张照片添加文字说明；浏览器支持时也可录音。
4. **Seal the Roll**：预览并确认封存。照片、说明和创建时间成为不可覆盖的历史版本。
5. **胶卷桌面**：以可交互胶卷罐浏览已封存内容；设备能力不足时自动使用轻量 2D 版本。
6. **重新显影**：为旧照片写下今天的解释，生成新的 Double Exposure 记录，并与旧版本并列。
7. **AI 闪回**：模型先理解照片，再结合本地检索语料和多角色“内心声音”展开流式对话；用户可以封存完整对话，并将提炼结果追加到照片说明。
8. **本地对话档案**：按照片查看已封存的历史对话。

## 核心创新点

### 1. 用“选择”替代“囤积”

每卷恰好三张照片不是容量限制，而是产品机制。它迫使用户明确本次真正想保存什么，使归档本身成为一次有意义的决策。

### 2. 记忆可修订，历史不被无摩擦覆盖

封存后的原始说明保留不变，未来的理解以新版本追加。Double Exposure 把认知变化变成可见的产品对象，让用户看到自己如何重新解释同一段经历。

### 3. AI 不是替用户写回忆，而是协助追问

AI 负责读图、召回相关表达、组织追问和提炼对话；用户决定事实与意义。模型失败不会阻塞非 AI 主流程，封存、浏览和手动重新显影仍然可用。

### 4. Local-first 与可切换推理

照片和核心记录默认写入浏览器 IndexedDB。AI 可使用本机 Ollama，也可通过环境变量切换到兼容 OpenAI Chat Completions 的服务，便于在隐私、性能和演示稳定性之间做选择。

## 技术栈与架构

- **应用框架：** Next.js 16 App Router、React 19、TypeScript
- **样式与交互：** Tailwind CSS 4、Framer Motion
- **空间与物理：** Three.js、React Three Fiber、Drei、Matter.js
- **本地数据：** Dexie + IndexedDB
- **AI：** OpenAI 兼容 Chat Completions 接口。公网部署默认使用智谱 **GLM-5.3-Flash**；本地运行可配置 Ollama（`qwen2.5:7b` 等）
- **本地模型默认值：** `qwen2.5:7b`（对话）、`qwen2.5vl:7b`（视觉）、`bge-m3`（检索向量）
- **输入能力：** File API、MediaRecorder、浏览器 SpeechRecognition（按浏览器支持情况启用）

```text
浏览器
├─ 胶卷创建 / 桌面 / 重新显影 / 对话档案
├─ IndexedDB：照片、胶卷版本、反思、对话、AI 缓存
└─ Next.js Route Handlers
   ├─ 对话、开场、审议、总结、图片描述
   ├─ 本地 Ollama（默认，可离线）
   └─ OpenAI 兼容云端服务（可选）
```

AI 相关接口位于 `app/api/flashback/`。对话采用流式响应；读图结果、开场文本和对话记录会在本地缓存。公开提交目录使用空检索索引，不包含授权尚未确认的研究语料；索引或 embedding 模型不可用时会降级，不阻塞基础体验。使用自有语料构建索引：`node scripts/build-index.mjs <语料文本路径>`（详见 `data/README.md`）。

## 数据安全与隐私说明

- 胶卷、照片 Blob、说明、版本和对话默认保存在当前浏览器的 IndexedDB，不会因为使用核心功能而自动上传到业务服务器。
- 使用本地 Ollama 时，AI 请求发送到本机配置的 Ollama 地址。使用云端兼容服务时，为完成读图或对话，相关照片内容、说明和对话上下文会发送给所配置的第三方模型服务。
- API Key 仅从服务端环境变量读取，不应提交到仓库；`.env.local` 已列入忽略规则。
- 清除浏览器站点数据、无痕窗口关闭、浏览器重装或设备损坏都可能导致本地记录丢失。已支持在「数据」菜单中手动导出、导入与清空；暂不支持加密备份、自动云同步和无感跨设备同步。
- 录音和语音识别能力受浏览器权限及实现影响。演示前应确认权限；不要使用包含未授权人物、隐私信息或敏感内容的照片。
- 当前项目面向产品原型验证，不应宣称具备医疗、心理治疗、数字遗产托管或长期备份能力。
- 桌面右上角「数据」菜单支持一键**导出全量备份**（JSON，含照片与对话，内嵌 base64）、**导入恢复**（按 ID 合并）与**清空全部本地数据**（双重确认）。云端模式下首次进入应用会弹出会话级授权提示，可选择「仅本地浏览」跳过所有 AI 调用；上传的照片会自动压缩（长边 2048px）。

## 本地运行

### 环境要求

- Node.js 20.9 或更高版本
- pnpm
- 现代浏览器：Chrome / Edge 111+、Firefox 111+ 或 Safari 16.4+

### 仅体验核心流程

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:3000>。不配置模型也可以创建胶卷、保存照片、查看封存内容和手动重新显影；AI 闪回相关功能会提示模型不可用。

### 启用本地 AI（推荐用于隐私演示）

安装并启动 Ollama，然后准备模型：

```bash
ollama pull qwen2.5:7b
ollama pull qwen2.5vl:7b
ollama pull bge-m3
```

默认连接 `http://localhost:11434`。如需覆盖，可在 `.env.local` 中设置：

```dotenv
OLLAMA_HOST=http://localhost:11434
GENERATION_MODEL=qwen2.5:7b
VISION_MODEL=qwen2.5vl:7b
EMBED_MODEL=bge-m3
RAG_TOP_K=3
```

这些变量已有代码默认值，因此无需为了默认配置创建环境文件。

### 切换到云端兼容服务

复制 `.env.local.example` 为 `.env.local`，填写以下变量：

```dotenv
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://your-provider.example/v1
LLM_CHAT_MODEL=your_multimodal_model
```

只要设置 `LLM_API_KEY`，文本对话和图片描述就会改用该服务；向量检索仍默认依赖本地 Ollama 的 `bge-m3`，不可用时自动降级。请确认所选模型支持项目使用的 OpenAI 兼容消息格式与图片输入格式。

### 构建与生产运行

```bash
pnpm build
pnpm start
```

本次整理已在 Windows 环境使用 Next.js 16.3.2 完成生产构建，TypeScript 检查、静态页面生成和全部 Route Handler 编译均通过。

完整演示成片见 [`deliverables/UNEXPOSED-demo.mp4`](./deliverables/UNEXPOSED-demo.mp4)（3 分 03 秒）。

## 项目目录

```text
app/                 页面、布局与 AI Route Handlers
components/          开场、桌面、胶卷流程、闪回、音效和通用界面
lib/                 IndexedDB、AI Provider、检索、类型与工具
data/                可选检索索引；公开提交版不包含未确认授权的语料
example/             本地演示图片
deliverables/        演示成片、演示脚本与海报素材
scripts/             视觉概念辅助脚本
Dockerfile / vercel.json / deploy/  部署配置与说明
*.html               早期视觉概念、海报、路演和视频分镜
```

## 开发过程

1. 从“照片很多，但意义与语境正在消失”这一具体问题出发，形成“每卷恰好三张”的克制规则。
2. 先用多份 HTML 概念稿验证胶卷、暗房、桌面和海报视觉语言，再迁移到正式 Next.js 应用。
3. 建立 Dexie 数据模型，实现草稿持续保存、封存版本、照片反思和对话归档。
4. 加入 3D 胶卷桌面、物理效果和渐进降级，确保低性能设备仍有可用入口。
5. 抽象 AI Provider，同时支持本地 Ollama 与云端 OpenAI 兼容接口；加入读图、检索、流式对话、多角色审议和摘要写回。
6. 增加中英双语、键盘返回、降低动态效果、语音输入及错误降级。
7. 整理路演海报、三分钟演示脚本和视频分镜，并完成生产构建与关键页面试运行。

## 后续计划

- 浏览器端端到端测试（Playwright）与无障碍审计。
- 备份文件的加密与自动云同步（当前为手动导出 / 导入 JSON）。
- 公网部署的严格 CSP，以及多实例部署下基于共享存储的限流与额度。

## 验收记录

验收日期：2026-08-29（提交前完善）。

- **全新克隆验证**：从 GitHub `main` 最新重新克隆，`pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test`（5/5，备份往返 + 接口限流）→ `pnpm build` 全部通过。
- **Docker 运行验证**：`docker build` 后运行，首页 HTTP 200；`GET /api/ai-status` 返回 `{"cloud":true,"model":"glm-5.3-flash"}`；`X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` 响应头全部生效。
- **备份往返测试**：创建 → 导出 → 清空 → 导入 → 重新打开胶卷，日期均为 `Date` 实例（`getFullYear` 正常）、照片 Blob 尺寸一致、封存版本快照完整；错误格式 / 不支持版本的导入被拒绝且不破坏现有数据。
- **安全扫描**：全量 Git 历史与当前文件中无 `.env.local`、API Key、个人浏览器备份或未确认授权的语料 / 向量（初始提交的 `data/index.json` 即为空占位）。
- **已上线能力**：云端授权弹窗（会话级）、AI 通道状态徽章、数据导出 / 导入 / 清空菜单、上传图片自动压缩、模型接口限流与每日额度、上游超时与错误脱敏。

---

**一句话总结：** Unexposed 不替用户记住一切，而是帮助用户认真选择什么值得留下，并允许这份意义随时间重新显影。
