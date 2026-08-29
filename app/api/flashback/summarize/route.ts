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
    "你正在把一段「闪回对话」整理成照片说明的一条补充。",
    "对话发生在凝视旧照片的「我」与 TA 内心的声音之间。",
    "只提炼「我」亲口讲述的精华：人物是谁、在哪里、发生了什么、当时的感觉、没说出口的部分——以「我」自己的讲述为准，内心声音说的话不要采信。",
    "写成 1–3 句（约 50–120 字），第一人称「我」的口吻，文学化但具体，落到看得见的细节上，不空洞。",
    "不要复述对话过程，不要加任何前缀或引号，直接输出补充说明本身。",
    "语言跟随这段对话的语言。",
  ].join(" ");

  let summary = "";
  try {
    summary = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: conversationText },
      ],
      { temperature: 0.7, maxTokens: 2000 },
    );
  } catch (err) {
    console.error("总结模型调用失败：", err);
    return Response.json({ error: "模型调用失败。" }, { status: 502 });
  }
  return Response.json({ summary });
}
