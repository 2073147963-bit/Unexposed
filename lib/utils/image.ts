// 上传压缩：长边超过 2048px 的图片等比缩小并转 JPEG（质量 0.85）。
// 原图直存会让 IndexedDB 配额与内存峰值快速失控；压缩后视觉损失可忽略。
const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.85;

export async function compressImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      // 尺寸达标且本就是 JPEG：无需重编码
      if (scale >= 1 && file.type === "image/jpeg") return file;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      return blob && blob.size > 0 ? blob : file;
    } finally {
      bitmap.close();
    }
  } catch {
    return file; // 解码失败（格式不支持等）：原样保存，不阻塞上传
  }
}
