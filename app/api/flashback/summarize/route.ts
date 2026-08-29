import { complete } from "@/lib/ai/provider";
import type { ConversationMessage } from "@/lib/types";

interface SummarizeRequest {
  messages: ConversationMessage[];
}

// 把一段闪回对话提炼成一条精炼的照片说明（写入 reflection 前使用）。
export async function POST(request: Request) {
  let body: SummarizeRequest;
  try {
    body = (await request.json()) as SummarizeRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "对方" : "爬虫脑"}: ${m.content}`)
    .join("\n");

  if (!conversationText.trim()) {
    return Response.json({ error: "没有可提炼的对话。" }, { status: 400 });
  }

  const system = [
    "你正在把一段「闪回对话」提炼成一条精炼的照片说明。",
    "这段对话发生在一个正在凝视旧照片的人，和 TA 内心的声音「爬虫脑」之间。",
    "请从对话中提炼出最核心的洞察——关于这张照片、关于 TA 的记忆、关于 TA 自己——写成 1–3 句话（约 50–120 字），用第一人称「我」的口吻，文学化但不空洞。",
    "不要复述对话，不要加任何前缀或引号，直接输出提炼结果本身。",
    "语言跟随这段对话的语言。",
  ].join(" ");

  let summary = "";
  try {
    summary = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: conversationText },
      ],
      { temperature: 0.7, maxTokens: 1000 },
    );
  } catch (err) {
    console.error("总结模型调用失败：", err);
    return Response.json({ error: "模型调用失败。" }, { status: 502 });
  }
  return Response.json({ summary });
}
