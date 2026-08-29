import { complete } from "@/lib/ai/provider";
import { buildSystemPrompt, type PhotoContext } from "@/lib/ai/style";

interface OpeningRequest {
  photoContext?: {
    caption?: string;
    reflections?: string[];
    takenAt?: string;
    description?: string;
  };
  language?: "zh" | "en";
  previousOpening?: string;
}

// 开场触发语：与语言包里的 flashbackOpening 保持一致。
const TRIGGER: Record<"zh" | "en", string> = {
  zh: "（你凝视着这张照片，陷入了闪回。开始说话。）",
  en: "(You stare at this photograph and slip into a flashback. Begin to speak.)",
};

// 预生成开场独白（非流式）。由封存 / 进详情页时后台调用，结果缓存进 IndexedDB，
// 闪回打开即读缓存秒开，不再现场等模型。
export async function POST(request: Request) {
  let body: OpeningRequest;
  try {
    body = (await request.json()) as OpeningRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const language: "zh" | "en" = body?.language === "en" ? "en" : "zh";
  const safePhotoContext: PhotoContext = {
    caption: body?.photoContext?.caption ?? "",
    reflections: Array.isArray(body?.photoContext?.reflections)
      ? body.photoContext.reflections.filter((r): r is string => typeof r === "string")
      : [],
    takenAt: body?.photoContext?.takenAt ?? "",
    description: typeof body?.photoContext?.description === "string" ? body.photoContext.description : "",
  };

  const system = buildSystemPrompt({
    photoContext: safePhotoContext,
    fragments: [],
    language,
    opening: true,
    previousOpening: typeof body?.previousOpening === "string" ? body.previousOpening : undefined,
  });

  let opening = "";
  try {
    opening = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: TRIGGER[language] },
      ],
      { temperature: 0.9, topP: 0.9, maxTokens: 4000 },
    );
  } catch (err) {
    console.error("开场独白生成失败：", err);
    return Response.json({ error: "开场独白生成失败。" }, { status: 502 });
  }
  return Response.json({ opening });
}
