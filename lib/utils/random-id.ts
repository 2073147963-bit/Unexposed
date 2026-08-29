// —— 安全上下文兼容的 UUID v4 ——
// crypto.randomUUID 仅存在于安全上下文（HTTPS 或 localhost）；局域网以 http://IP 访问时
// 该方法为 undefined，会导致建卷/存档静默失败。crypto.getRandomValues 不受此限制，
// 因此在非安全上下文用它按 RFC 4122 v4 格式兜底，两条路径行为一致。
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(
    /[018]/g,
    (char) =>
      (
        Number(char) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))
      ).toString(16),
  );
}
