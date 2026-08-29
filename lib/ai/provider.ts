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
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(requestBody(model, messages, stream, opts)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`模型返回 ${res.status}：${detail.slice(0, 500)}`);
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
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

// 流式补全：把 SSE 转成纯文本流（前端无需任何改动）。
export async function stream(
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
              const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) controller.enqueue(encoder.encode(delta));
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
