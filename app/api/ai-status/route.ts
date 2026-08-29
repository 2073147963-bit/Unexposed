import { CHAT_MODEL, isCloud } from "@/lib/ai/provider";

// 供前端显示当前推理通道（本地 / 云端）并做会话级授权判断；不返回任何凭据信息。
export async function GET() {
  return Response.json({ cloud: isCloud, model: CHAT_MODEL });
}
