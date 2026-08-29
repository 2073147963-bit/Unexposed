import { completeVision } from "@/lib/ai/provider";

interface DescribeRequest {
  image: string;
}

// 用视觉模型「读取」照片，返回一段客观的画面描述（供闪回对话作为事实底座）。
// 前端只调用一次并把结果缓存进 IndexedDB，之后直接读缓存，不再重复跑视觉模型。
export async function POST(request: Request) {
  let body: DescribeRequest;
  try {
    body = (await request.json()) as DescribeRequest;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const image = body?.image;
  if (typeof image !== "string" || !image) {
    return Response.json({ error: "An image is required." }, { status: 400 });
  }

  const prompt = [
    "请客观描述这张照片：画面里有什么人、物、场景，大概的色调和氛围，以及你能辨认出的关键细节（文字、地点标志、时间线索等）。",
    "只描述你看到的事实，不要加入主观情感、联想或编造不存在的细节；看不清的地方就跳过。",
    "用中文，2–4 句。必须用中文回答，不要使用英文。",
  ].join(" ");

  let description = "";
  try {
    description = await completeVision(prompt, image, { temperature: 0.2, maxTokens: 2000 });
  } catch (err) {
    console.error("视觉描述失败：", err);
    return Response.json({ error: "视觉模型调用失败。" }, { status: 502 });
  }
  if (!description) {
    return Response.json({ error: "视觉模型未返回描述。" }, { status: 502 });
  }
  return Response.json({ description });
}
