import { isCloud, streamEvents, type LLMMessage } from "@/lib/ai/provider";
import { FLASHBACK_LIMITS, clientIp, rateLimit, readJsonWithLimit } from "@/lib/api/guard";
import { retrieve } from "@/lib/ai/retrieve";
import { buildSystemPrompt, detectLanguage, getThought, type PhotoContext } from "@/lib/ai/style";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FlashbackRequest {
  message: string;
  photoContext?: PhotoContext;
  history?: ChatMessage[];
  thoughtId?: string;
}

export async function POST(request: Request) {
  // 服务端保护：IP 限流 + 每日额度（前端授权弹窗是体验提示，不是安全边界）。
  const limited = rateLimit(clientIp(request), FLASHBACK_LIMITS);
  if (!limited.ok) {
    return Response.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 60) } },
    );
  }

  const parsed = await readJsonWithLimit<FlashbackRequest>(request, 262_144);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const { message, photoContext, history = [] } = body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }
  if (message.length > 4000) {
    return Response.json({ error: "Message too long (max 4000 chars)." }, { status: 413 });
  }
  if (!Array.isArray(history) || history.length > 40) {
    return Response.json({ error: "Too many history entries." }, { status: 413 });
  }
  if (history.some((entry) => typeof entry?.content !== "string" || entry.content.length > 8000)) {
    return Response.json({ error: "History entry too long." }, { status: 413 });
  }
  if (typeof photoContext?.description === "string" && photoContext.description.length > 8000) {
    return Response.json({ error: "Photo context too long." }, { status: 413 });
  }

  const safePhotoContext: PhotoContext = {
    caption: photoContext?.caption ?? "",
    reflections: Array.isArray(photoContext?.reflections) ? photoContext.reflections : [],
    takenAt: photoContext?.takenAt ?? "",
    description: typeof photoContext?.description === "string" ? photoContext.description : "",
  };

  // 首轮（开场独白）用极简 prompt 且跳过 RAG，让第一句尽快出现；后续轮次再走完整路径。
  const opening = history.length === 0;
  // 其他脑层（爬虫脑/新皮层）在用户完成三轮对话之后才允许插话。
  const userTurns = history.filter((m) => m.role === "user").length;
  const allowInterjection = userTurns >= 3;

  // 1. RAG 检索（开场跳过；失败时降级为无 RAG，仍可对话——索引缺失不应阻断闪回）。
  let fragments: { text: string }[] = [];
  if (!opening) {
    try {
      fragments = await retrieve(message);
    } catch (err) {
      console.error("RAG 检索失败（索引未构建或 Ollama 未启动）：", err);
    }
  }

  // 2. 拼装 system prompt（风格人格 + 照片上下文 + 思维阁 + RAG 片段 + 语言指令）。
  const system = buildSystemPrompt({
    photoContext: safePhotoContext,
    fragments,
    language: detectLanguage(message),
    thought: getThought(body?.thoughtId),
    opening,
    allowInterjection,
  });

  const llmMessages: LLMMessage[] = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // 3. 调用 Provider 流式生成（NDJSON 事件流：思考与正文都实时透传，前端边生成边呈现）。
  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await streamEvents(llmMessages, { temperature: 0.9, topP: 0.9, maxTokens: 3000 });
  } catch (err) {
    console.error("模型调用失败：", err);
    return Response.json(
      { error: isCloud ? "云端模型调用失败。" : "本地模型服务未启动。请先运行 ollama serve。" },
      { status: 502 },
    );
  }

  return new Response(streamBody, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
