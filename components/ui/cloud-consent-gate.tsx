"use client";

// 云端推理授权弹窗：云端模式下首次进入应用时询问一次，选择写入 sessionStorage（会话级）。
// 选择「仅本地浏览」后，本会话的 AI 调用会被跳过（见 lib/ai/consent.ts 的 ensureCloudAllowed）。
import { useEffect, useState } from "react";

import { useLanguage } from "@/components/ui/language-provider";
import { fetchAiStatus, readCloudConsent, writeCloudConsent } from "@/lib/ai/consent";

export function CloudConsentGate() {
  const { language } = useLanguage();
  const zh = language === "zh";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await fetchAiStatus();
      if (!cancelled && status.cloud && readCloudConsent() === "unset") setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function decide(state: "accepted" | "declined") {
    writeCloudConsent(state);
    setVisible(false);
  }

  return (
    <div className="cloud-consent-overlay" role="dialog" aria-modal="true" aria-label="Cloud AI consent">
      <div className="cloud-consent-panel">
        <p className="cloud-consent-title">{zh ? "云端 AI 授权" : "Cloud AI consent"}</p>
        <p className="cloud-consent-body">
          {zh
            ? "当前已配置云端模型服务（智谱 GLM）。使用「闪回对话」与照片预生成时，照片画面、说明与对话上下文会发送到该服务用于生成；照片原件始终只保存在你的浏览器。"
            : "A cloud model service (Zhipu GLM) is configured. Flashback conversations and photo pre-generation send photo frames, captions and conversation context to that service; original photos always stay in your browser."}
        </p>
        <div className="cloud-consent-actions">
          <button type="button" className="cloud-consent-accept" onClick={() => decide("accepted")}>
            {zh ? "启用云端 AI" : "Enable cloud AI"}
          </button>
          <button type="button" className="cloud-consent-decline" onClick={() => decide("declined")}>
            {zh ? "仅本地浏览" : "Local only"}
          </button>
        </div>
      </div>
    </div>
  );
}
