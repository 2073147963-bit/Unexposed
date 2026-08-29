import { stream, type LLMMessage } from "@/lib/ai/provider";
import { buildDeliberationPrompt, getThought, type PhotoContext } from "@/lib/ai/style";

interface DeliberateRequest {
  message: string;
  photoContext?: PhotoContext;
  language?: "zh" | "en";
  thoughtId?: string;
}

// 「出声思考」：正式回答前，三重脑就这句话的内心争执（流式）。与主回答并行，
// 先到先显示，作为等待期的「思考层」。失败时前端静默降级，不影响主回答。
export async function POST(request: Request) {
  let body: DeliberateRequest;
  try {
    body = (await request.json()) as DeliberateRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }

  const safePhotoContext: PhotoContext = {
    caption: body?.photoContext?.caption ?? "",
    reflections: [],
    takenAt: body?.photoContext?.takenAt ?? "",
    description: typeof body?.photoContext?.description === "string" ? body.photoContext.description : "",
  };

  const system = buildDeliberationPrompt({
    photoContext: safePhotoContext,
    language: body?.language === "en" ? "en" : "zh",
    thought: getThought(body?.thoughtId),
  });

  const llmMessages: LLMMessage[] = [
    { role: "system", content: system },
    { role: "user", content: message },
  ];

  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await stream(llmMessages, { temperature: 0.9, topP: 0.9, maxTokens: 2000 });
  } catch (err) {
    console.error("内心争执生成失败：", err);
    return Response.json({ error: "内心争执生成失败。" }, { status: 502 });
  }

  return new Response(streamBody, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
