import { isCloud } from "@/lib/ai/provider";
import { OLLAMA_HOST, VISION_MODEL } from "@/lib/ai/config";

// 预热视觉模型（fire-and-forget）：把模型加载进内存，消除首次描述时的冷启动延迟。
// 云端模式下无需预热本地模型。
export async function GET() {
  if (isCloud) return Response.json({ ok: true });
  try {
    await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_MODEL,
        keep_alive: -1,
        stream: false,
        messages: [{ role: "user", content: "warm up" }],
        options: { num_predict: 1 },
      }),
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("视觉模型预热失败：", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}
