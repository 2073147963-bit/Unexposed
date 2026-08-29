"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "zh";

const copy = {
  en: {
    deskLabel: "Your sealed film rolls", sealedRolls: "SEALED ROLLS", empty: "YOUR TABLE IS EMPTY",
    start: "Start a roll", newRoll: "+ NEW ROLL", deskHint: "CLICK THE CANISTER TO OPEN THE REEL.",
    returnTable: "ESC / RETURN TO TABLE", ready: "READY TO OPEN", backDesk: "Back to Desk",
    opening: "Opening sealed roll…", missing: "This sealed roll could not be found on this device.",
    then: "THEN", originalRecord: "ORIGINAL RECORD", noCaption: "No caption was added.",
    openHint: "SCROLL HORIZONTALLY TO FEED THE FILM · DOUBLE-CLICK A FRAME TO ENLARGE",
    closeHint: "CLICK OUTSIDE OR PRESS ESC TO RETURN", flashback: "Enter Flashback Mode",
    reflection: "YOUR NOTE",
    redevelop: "Re-develop", chooseExposure: "CHOOSE AN EXPOSURE TO RE-DEVELOP",
    redevelopPrompt: "You kept this once. What does it mean to you now?", submitReflection: "Develop Reflection",
    writingNow: "Write what this photograph means now…", thenRecord: "THEN", nowRecord: "NOW",
    nothingThen: "Nothing was written then.", reflectionSaved: "Reflection developed and stored locally.",
    rollLabel: "sealed film roll", loading: "Loading your desk…",
    flashbackSubtitle: "your heart, speaking from the chest",
    flashbackOpening: "(You stare at this photograph and slip into a flashback. Begin to speak.)",
    flashbackThinking: "THE VOICES DELIBERATE",
    flashbackOn: "FLASHBACK ON",
    flashbackPlaceholder: "Speak to the photograph…",
    flashbackSend: "Send",
    flashbackError: "Could not reach the local model. Make sure Ollama is running.",
    flashbackVoice: "Mic",
    flashbackVoiceStop: "Listening…",
    flashbackSeal: "Seal Dialogue",
    flashbackSealing: "Sealing…",
    flashbackSealedLabel: "DIALOGUE SEALED · WRITTEN BACK TO THE PHOTO",
    flashbackSealedEmpty: "(no insight could be distilled)",
    flashbackSealedDone: "Done",
    flashbackSealError: "Could not seal the dialogue.",
    viewConversations: "Conversation Archive",
    conversationArchiveTitle: "ARCHIVED DIALOGUES",
    conversationEmpty: "No dialogues sealed for this photograph yet.",
    conversationYou: "YOU",
  },
  zh: {
    deskLabel: "你的封存胶卷", sealedRolls: "卷已封存", empty: "桌面还是空的",
    start: "开始一卷", newRoll: "+ 新胶卷", deskHint: "点击胶卷，展开记忆。",
    returnTable: "ESC / 返回桌面", ready: "准备展开", backDesk: "返回桌面",
    opening: "正在打开封存胶卷…", missing: "在此设备上找不到这卷胶卷。",
    then: "那时", originalRecord: "原始记录", noCaption: "没有添加说明。",
    openHint: "横向滚动展开胶片 · 双击画面放大",
    closeHint: "点击空白处或按 ESC 返回", flashback: "进入闪回模式",
    reflection: "你的说明",
    redevelop: "重新显影", chooseExposure: "选择一张照片重新显影",
    redevelopPrompt: "你曾经留下了它。现在，它对你意味着什么？", submitReflection: "显影这次反思",
    writingNow: "写下这张照片此刻对你的意义……", thenRecord: "那时", nowRecord: "现在",
    nothingThen: "那时什么也没有写。", reflectionSaved: "新的反思已显影并保存在本地。",
    rollLabel: "封存胶卷", loading: "正在加载桌面…",
    flashbackSubtitle: "你的心，从胸腔说话",
    flashbackOpening: "（你凝视着这张照片，陷入了闪回。开始说话。）",
    flashbackThinking: "内心争执中",
    flashbackOn: "闪回于",
    flashbackPlaceholder: "对这张照片说点什么……",
    flashbackSend: "发送",
    flashbackError: "无法连接本地模型。请确认 Ollama 已启动。",
    flashbackVoice: "语音",
    flashbackVoiceStop: "聆听中…",
    flashbackSeal: "封存对话",
    flashbackSealing: "封存中…",
    flashbackSealedLabel: "对话已封存 · 已写回照片说明",
    flashbackSealedEmpty: "（未能提炼出内容）",
    flashbackSealedDone: "完成",
    flashbackSealError: "无法封存对话。",
    viewConversations: "对话记录",
    conversationArchiveTitle: "已封存的对话",
    conversationEmpty: "这张照片还没有封存过对话。",
    conversationYou: "你",
  },
} as const;

type CopyKey = keyof typeof copy.en;
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: CopyKey) => string };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("unexposed-language");
    const initial = saved === "zh" || saved === "en" ? saved : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    setLanguage(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("unexposed-language", language);
  }, [hydrated, language]);

  const value = useMemo(() => ({ language, setLanguage, t: (key: CopyKey) => copy[language][key] }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
      <div className="language-switch" role="group" aria-label="Language / 语言">
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
        <span>/</span>
        <button type="button" className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中</button>
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
