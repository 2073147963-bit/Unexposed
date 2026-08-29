import { isCloud } from "@/lib/ai/provider";
import { GENERATION_MODEL, OLLAMA_HOST } from "@/lib/ai/config";

// 预热：把生成模型加载进内存（keep_alive 常驻），消除首次进入闪回时的冷启动延迟。
// 前端进入胶卷详情页时 fire-and-forget 调用，不阻塞页面。云端模式下无需预热本地模型。
export async function GET() {
  if (isCloud) return Response.json({ ok: true });
  try {
    await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GENERATION_MODEL,
        keep_alive: -1,
        stream: false,
        messages: [{ role: "user", content: "warm up" }],
        options: { num_predict: 1 },
      }),
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("预热失败：", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}
