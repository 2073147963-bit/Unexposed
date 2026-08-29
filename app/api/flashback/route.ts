import { isCloud, stream, type LLMMessage } from "@/lib/ai/provider";
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
  let body: FlashbackRequest;
  try {
    body = (await request.json()) as FlashbackRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { message, photoContext, history = [] } = body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "A message is required." }, { status: 400 });
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

  // 3. 调用 Provider 流式生成（本地 Ollama 或云端 GLM，一套代码）。
  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await stream(llmMessages, { temperature: 0.9, topP: 0.9, maxTokens: 3000 });
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
