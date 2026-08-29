# UNEXPOSED · 未显影 — 服务器部署指南

本应用是 **Next.js 16 网页应用**：用户照片与对话全部存在**访问者自己的浏览器**（IndexedDB），
服务器**零数据库、零文件存储**，因此迁移到任何服务器只需要部署应用本身 + 配置一个模型通道。

---

## 一、先回答关键问题：内置模型能否随网页一起移植？

**不能打包进网页，但也不阻碍完整移植。** 结论分三种情况：

| 模式 | 服务器需要什么 | 功能完整度 |
|---|---|---|
| **A · 云端 GLM（推荐）** | 只需一个智谱 API Key（环境变量 `LLM_API_KEY`） | **100% 完整**：闪回对话、三脑争执、开场独白、读图描述、摘要写回全部可用 |
| **B · 本地 Ollama（离线）** | 服务器安装 Ollama 并拉取 3 个模型：`bge-m3`（≈1.2GB，RAG 检索）、`qwen2.5:7b`（≈4.7GB，文本生成）、`qwen2.5vl:7b`（≈6GB，读图） | 100% 完整，且完全离线；代价是服务器要 ~12GB 模型盘存 |
| **C · 什么都不配** | 无 | **应用本体可运行**（建卷、传照片、封存、重新显影、桌面交互均不依赖模型），但闪回对话/开场独白会报错提示；RAG 检索缺失会自动静默降级，不阻塞 |

> 汇报：模型权重（数 GB）不可能"封装进网页"，这是所有 LLM 应用的共性。项目已做**双通道设计**：
> 同一套代码，云端走 OpenAI 兼容协议（智谱 GLM-5.3-Flash），断网/无 Key 自动降级本地 Ollama。
> 因此"完整运行"的正确姿势是 **模式 A 配一个 Key**，五分钟内可完成。

---

## 二、部署步骤（模式 A · 云端 GLM）

要求：服务器有 **Node.js ≥ 20** 与 **pnpm**（或 npm）。

```bash
# 1. 解压 unexposed-deploy.zip（或 git clone 仓库）
cd unexposed

# 2. 安装依赖
pnpm install

# 3. 配置模型通道
cp .env.local.example .env.local
#    编辑 .env.local，填入：
#    LLM_API_KEY=你的智谱Key        # 在 open.bigmodel.cn 申请
#    LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
#    LLM_CHAT_MODEL=glm-5.3-flash

# 4. 构建 + 启动
pnpm build
pnpm start          # 默认 3000 端口；PORT=8080 pnpm start 可换端口
```

访问 `http://服务器IP:3000` 即为完整应用。建议前面挂 Nginx/Caddy 反代 + HTTPS。

## 三、部署步骤（模式 B · 离线 Ollama）

```bash
# 服务器安装 Ollama 后：
ollama pull bge-m3 && ollama pull qwen2.5:7b && ollama pull qwen2.5vl:7b
# 重建风格语料索引（一次性）：
node scripts/build-index.mjs <语料文本路径>
# .env.local 留空 LLM_API_KEY 即自动走 Ollama
pnpm build && pnpm start
```

## 四、Docker 部署（任一模式通用）

```bash
docker build -t unexposed .
docker run -d -p 3000:3000 --env-file .env.local --name unexposed unexposed
```
镜像基于 `output: "standalone"`（见 `next.config.ts`），产出自包含服务，无需在容器里装 node_modules。

## 五、说明与注意事项

- **数据归属**：所有胶卷/照片/对话存在访问者浏览器 IndexedDB；换浏览器/设备数据不跟随（这是产品的隐私立场，不是缺陷）。
- **`next build` 产出**：`.next/standalone/server.js` 可独立运行（`node server.js`），并需把 `.next/static` 一并带上（Dockerfile 已处理）。
- **安全**：`.env.local`（含 API Key）绝不入仓库/镜像；泄露请立即在智谱控制台吊销。
- **健康检查**：`GET /` 返回 200；`GET /api/flashback/warmup` 返回 200/204 表示模型通道已配置。
- 本目录 `DEPLOY.md` 与根目录 `Dockerfile`、`next.config.ts` 均已包含在 `unexposed-deploy.zip` 中。
