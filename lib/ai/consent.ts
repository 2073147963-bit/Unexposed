// 云端推理会话级授权：记录用户对「照片与对话将发送到云端模型服务」的选择。
// accepted / declined 仅本会话有效（sessionStorage）；unset 表示尚未询问。
const CONSENT_KEY = "unexposed-cloud-consent";

export type CloudConsent = "accepted" | "declined" | "unset";

export function readCloudConsent(): CloudConsent {
  if (typeof window === "undefined") return "unset";
  const value = window.sessionStorage.getItem(CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : "unset";
}

export function writeCloudConsent(state: "accepted" | "declined"): void {
  window.sessionStorage.setItem(CONSENT_KEY, state);
}

export interface AiStatus {
  cloud: boolean;
  model: string;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const res = await fetch("/api/ai-status");
    if (!res.ok) return { cloud: false, model: "" };
    return (await res.json()) as AiStatus;
  } catch {
    return { cloud: false, model: "" };
  }
}

// 云端模式下，AI 相关调用前统一过这个闸：用户选择「仅本地」时返回 false，调用方跳过请求。
export async function ensureCloudAllowed(): Promise<boolean> {
  const status = await fetchAiStatus();
  if (!status.cloud) return true; // 本地推理不涉及第三方传输，无需授权
  return readCloudConsent() === "accepted";
}
