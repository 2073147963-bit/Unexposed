import { getPhotoDescription, getPhotoOpening, savePhotoDescription, savePhotoOpening } from "@/lib/db";
import type { PhotoContext } from "@/lib/ai/style";

// 把图片 Blob 降采样成 JPEG 裸 base64，供视觉模型读取。
// 原图往往数百万像素，直接发送会在 CPU 上拖慢视觉编码；压到长边 ≤768 后体积与耗时都大降，场景描述质量不受影响。
async function blobToVisionBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 768;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl.split(",")[1] ?? "");
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the image."));
    };
    img.src = url;
  });
}

// 对一张照片做视觉描述：有缓存直接返回，没有则调视觉模型并写回缓存。
// 失败返回空串，调用方可自行降级（比如退回「看不清」）。
// 既可在闪回打开时 await（带「显影中」提示），也可在封存/浏览时 fire-and-forget 后台预生成。
export async function describePhoto(photoId: string, imageBlob: Blob): Promise<string> {
  const cached = await getPhotoDescription(photoId);
  if (cached?.description) return cached.description;

  const base64 = await blobToVisionBase64(imageBlob);
  const res = await fetch("/api/flashback/describe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) return "";

  const data = (await res.json().catch(() => null)) as { description?: string } | null;
  const description = data?.description?.trim() || "";
  if (description) {
    await savePhotoDescription({ photoId, description, createdAt: new Date() });
  }
  return description;
}

// 开场提示词版本：改动 OPENING_SYSTEM_PROMPT 时 +1，版本不符的旧缓存会被重新生成。
export const OPENING_PROMPT_VERSION = 2;

// 生成开场独白：有缓存（且语言、版本都匹配）直接返回，否则调云端并写回缓存。
export async function generateOpening(
  photoId: string,
  photoContext: PhotoContext,
  language: "zh" | "en",
): Promise<string> {
  const cached = await getPhotoOpening(photoId);
  if (cached?.opening && cached.language === language && cached.version === OPENING_PROMPT_VERSION) {
    return cached.opening;
  }

  const res = await fetch("/api/flashback/opening", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoContext, language }),
  });
  if (!res.ok) return "";

  const data = (await res.json().catch(() => null)) as { opening?: string } | null;
  const opening = data?.opening?.trim() || "";
  if (opening) {
    await savePhotoOpening({ photoId, opening, language, version: OPENING_PROMPT_VERSION, createdAt: new Date() });
  }
  return opening;
}

// 预计算一张照片的「事实底座」：视觉描述 + 开场独白，双双缓存后，闪回打开即可秒开。
// 封存时 / 进入详情页时 fire-and-forget 调用；失败不影响主流程。
export async function precomputePhoto(
  photo: { id: string; imageBlob: Blob; caption: string; createdAt: Date },
  language: "zh" | "en",
): Promise<void> {
  const description = await describePhoto(photo.id, photo.imageBlob);
  if (!description) return;
  const locale = language === "zh" ? "zh-CN" : "en";
  const takenAt = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(photo.createdAt);
  await generateOpening(
    photo.id,
    { caption: photo.caption, reflections: [], takenAt, description },
    language,
  );
}
