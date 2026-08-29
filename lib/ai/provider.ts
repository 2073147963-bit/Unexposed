// —— LLM Provider 抽象 ——
// 默认走本地 Ollama 的 OpenAI 兼容接口（http://localhost:11434/v1），离线可用、零外部依赖。
// 在 .env.local 里设置 LLM_API_KEY 后，自动切到云端 OpenAI 兼容服务（默认智谱 GLM-5.3-Flash，
// 可用 LLM_BASE_URL / LLM_CHAT_MODEL 覆盖）。
//
// 云端：glm-5.3-flash 是原生多模态模型，一个模型通吃「文本对话」+「读图描述」。
// 本地：仍需两个模型（qwen2.5:7b 生成 + qwen2.5vl:7b 视觉）。
//
// 说明：RAG 的 embedding（bge-m3）仍走本地 Ollama，见 lib/ai/retrieve.ts——它本身很快，
// 且在索引缺失 / Ollama 未启动时会自动降级，不阻塞对话。

import { GENERATION_MODEL, OLLAMA_HOST, VISION_MODEL } from "./config";

const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_BASE_URL = (
  process.env.LLM_BASE_URL ||
  (LLM_API_KEY ? "https://open.bigmodel.cn/api/paas/v4" : `${OLLAMA_HOST}/v1`)
).replace(/\/+$/, "");

export const isCloud = Boolean(LLM_API_KEY);
const CLOUD_MODEL = process.env.LLM_CHAT_MODEL || "glm-5.3-flash";
export const CHAT_MODEL = isCloud ? CLOUD_MODEL : GENERATION_MODEL;
export const VISION = isCloud ? CLOUD_MODEL : VISION_MODEL;

export type Content =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: Content;
}

interface Options {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  reasoningEffort?: "low" | "high" | "max";
}

function requestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isCloud) headers.Authorization = `Bearer ${LLM_API_KEY}`;
  return headers;
}

function requestBody(model: string, messages: LLMMessage[], stream: boolean, opts: Options) {
  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.topP !== undefined ? { top_p: opts.topP } : {}),
    ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
  };
  if (isCloud) {
    // GLM-5.3-Flash 是「始终思考」模型，思考不可关闭；用 low 档压低推理延迟与 token 消耗。
    body.thinking = { type: "enabled", reasoning_effort: opts.reasoningEffort ?? "low" };
  } else {
    body.keep_alive = -1; // 本地：让模型常驻内存，消除下次冷启动。
  }
  return body;
}

async function call(
  model: string,
  messages: LLMMessage[],
  stream: boolean,
  opts: Options,
): Promise<Response> {
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 120_000);
  let res: Response;
  try {
    res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify(requestBody(model, messages, stream, opts)),
      // 上游超时：避免异常请求长期占用连接（思考模型正常耗时约 10–40s，上限放宽到 2 分钟）。
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`模型响应超时（${Math.round(timeoutMs / 1000)}s），请稍后再试。`);
    }
    throw new Error("无法连接模型服务，请检查网络。");
  }
  if (!res.ok) {
    // 不把上游错误体透传到日志或客户端（其中可能回显用户内容）；仅记录状态码。
    console.error(`上游模型返回错误：status=${res.status} model=${model}`);
    if (res.status === 401) throw new Error("模型服务鉴权失败，请检查 API Key 配置。");
    if (res.status === 429) throw new Error("模型服务限流中，请稍后再试。");
    throw new Error(`模型服务返回错误（${res.status}），请稍后再试。`);
  }
  return res;
}

// 非流式补全，返回纯文本。
export async function complete(
  messages: LLMMessage[],
  opts: Options & { model?: string } = {},
): Promise<string> {
  const res = await call(opts.model || CHAT_MODEL, messages, false, opts);
  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
  } | null;
  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  // 思考模型可能把 max_tokens 全部耗在推理上（finish_reason=length 且正文为空）。
  // 加倍预算自动重试一次，消除随机性空回复。
  if (!content && data?.choices?.[0]?.finish_reason === "length" && opts.maxTokens && opts.maxTokens < 8000) {
    return complete(messages, { ...opts, maxTokens: opts.maxTokens * 2 });
  }
  return content;
}

// 流式补全：把事件流转回纯文本流（只含正文，供争执等旧调用方使用）。
// 注意：事件行可能被 TCP 分块从中间切断，必须跨块缓冲到完整行再解析，
// 否则会随机丢弃半行文本（争执某句凭空缺一截）。
export async function stream(
  messages: LLMMessage[],
  opts: Options & { model?: string } = {},
): Promise<ReadableStream<Uint8Array>> {
  const events = await streamEvents(messages, opts);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = events.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as { type?: string; text?: string };
              if (event.type === "content" && event.text) controller.enqueue(encoder.encode(event.text));
            } catch { /* 忽略不完整行 */ }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

// 流式补全（NDJSON 事件流）：思考模型的 reasoning_content 在正文前流式产出，
// 若直接丢弃，前端会在首字前经历漫长空屏。这里把思考与正文都转成逐行 JSON 事件
// （{"type":"reasoning"|"content","text":"..."}\n），让前端边生成边呈现两种流。
export async function streamEvents(
  messages: LLMMessage[],
  opts: Options & { model?: string } = {},
): Promise<ReadableStream<Uint8Array>> {
  const res = await call(opts.model || CHAT_MODEL, messages, true, opts);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = res.body!.getReader();
      let buffer = "";
      const emit = (type: "reasoning" | "content", text: string) => {
        controller.enqueue(encoder.encode(JSON.stringify({ type, text }) + "\n"));
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") return;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string; reasoning_content?: string; reasoning?: string } }>;
              };
              const delta = parsed?.choices?.[0]?.delta;
              const reasoning = delta?.reasoning_content ?? delta?.reasoning;
              if (typeof reasoning === "string" && reasoning) emit("reasoning", reasoning);
              if (typeof delta?.content === "string" && delta.content) emit("content", delta.content);
            } catch {
              // 忽略无法解析的行（可能是 keep-alive 心跳等）。
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

// 视觉描述：文本提示 + 一张 base64 图（无 data URL 前缀则自动补上）交给多模态模型。
export async function completeVision(text: string, imageBase64: string, opts: Options = {}): Promise<string> {
  const url = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  return complete(
    [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url } }] }],
    { ...opts, model: VISION },
  );
}
