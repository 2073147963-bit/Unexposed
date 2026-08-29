"use client";

import { motion } from "framer-motion";
import { Fragment, useEffect, useRef, useState } from "react";
import { BlobImage } from "@/components/ui/blob-image";
import { useLanguage } from "@/components/ui/language-provider";
import { THOUGHTS } from "@/lib/ai/style";
import { appendPhotoCaption, getPhotoDescription, getPhotoOpening, saveConversation } from "@/lib/db";
import { describePhoto, OPENING_PROMPT_VERSION } from "@/lib/describe-photo";
import type { ConversationMessage, HistoricalPhotoMemory, Reflection } from "@/lib/types";

export interface VoiceSegment {
  voice: string;
  text: string;
}

export const MAIN_VOICE = "LIMBIC_BRAIN";

// 把模型输出里的 [[VOICE]] 插话标记切成段落，供不同样式渲染。
export function parseSegments(content: string): VoiceSegment[] {
  const segments: VoiceSegment[] = [];
  const re = /\[\[([A-Z ]+)\]\]/g;
  let lastIndex = 0;
  let currentVoice = MAIN_VOICE;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const text = content.slice(lastIndex, match.index).trim();
    if (text) segments.push({ voice: currentVoice, text });
    currentVoice = match[1].trim().replace(/ /g, "_");
    lastIndex = match.index + match[0].length;
  }
  let tail = content.slice(lastIndex);
  const openTag = tail.match(/\[\[[A-Z ]*$/);
  if (openTag?.index !== undefined) tail = tail.slice(0, openTag.index);
  const trimmedTail = tail.trim();
  if (trimmedTail) segments.push({ voice: currentVoice, text: trimmedTail });
  return segments;
}

// 三重脑：爬虫脑（主声音）+ 哺乳脑、新皮层（偶尔插话）。
export function voiceClass(voice: string): string {
  switch (voice) {
    case "LIMBIC_BRAIN": return "flashback-seg-limbic";
    case "NEOCORTEX": return "flashback-seg-neocortex";
    default: return "flashback-seg-reptilian";
  }
}

export function voiceLabel(voice: string, language: "en" | "zh"): string {
  const labels: Record<string, { en: string; zh: string }> = {
    REPTILIAN_BRAIN: { en: "ANCIENT REPTILIAN BRAIN", zh: "爬虫脑" },
    LIMBIC_BRAIN: { en: "LIMBIC BRAIN", zh: "哺乳脑" },
    NEOCORTEX: { en: "NEOCORTEX", zh: "新皮层" },
  };
  const label = labels[voice];
  if (label) return language === "zh" ? label.zh : label.en;
  return voice.replace(/_/g, " ");
}

export function FlashbackChat({
  photo,
  reflections,
  onClose,
}: {
  photo: HistoricalPhotoMemory;
  reflections: Reflection[];
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  // 每次闪回会话随机点亮一个「思维」，会话内保持不变。
  const [thought] = useState(() => THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [summary, setSummary] = useState("");
  const [thinking, setThinking] = useState("");
  const historyRef = useRef<ConversationMessage[]>([]);
  const turnRef = useRef(0);
  const descriptionRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const handleCloseRef = useRef<() => void>(() => {});
  const closingRef = useRef(false);
  const sealingRef = useRef(false);

  // 语音输入（Web Speech API）。
  const [voiceSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const finalTextRef = useRef("");

  useEffect(() => {
    // openedRef 保证 StrictMode 双挂载下也只跑一次（去掉 cancelled：它会在 StrictMode 的
    // 模拟卸载里把开场吞掉，导致点进去不说话、要用户先开口）。
    if (openedRef.current) return;
    openedRef.current = true;
    void (async () => {
      // 1. 读缓存：视觉描述 + 开场独白。
      let cachedOpening = "";
      try {
        const cached = await getPhotoDescription(photo.id);
        if (cached?.description) descriptionRef.current = cached.description;
        const opening = await getPhotoOpening(photo.id);
        if (opening?.opening && opening.language === language && opening.version === OPENING_PROMPT_VERSION) {
          cachedOpening = opening.opening;
        }
      } catch { /* 缓存读取失败不影响开场 */ }
      // 2. 开场：有缓存的独白就直接显示（秒开），没有则现场生成。
      if (cachedOpening) {
        historyRef.current = [{ role: "assistant", content: cachedOpening }];
        setMessages([{ role: "assistant", content: cachedOpening }]);
      } else {
        void send(t("flashbackOpening"), { hidden: true });
      }
      // 3. 后台确保视觉描述就绪（无缓存则生成并缓存），完成后回填，供后续轮次接地。
      try {
        const description = await describePhoto(photo.id, photo.imageBlob);
        if (description) descriptionRef.current = description;
      } catch { /* 描述失败则保持无描述 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    node?.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(
    () => () => { recognitionRef.current?.stop(); },
    [],
  );

  // 出声思考：拉取三重脑争执流写入 thinking（本轮失效则丢弃，失败静默降级）。
  async function runDeliberation(
    message: string,
    photoContext: { caption: string; reflections: string[]; takenAt: string; description: string },
    turn: number,
  ) {
    try {
      const res = await fetch("/api/flashback/deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, photoContext, language }),
      });
      if (!res.ok) return;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (turnRef.current !== turn) return; // 本轮已结束，丢弃
        content += decoder.decode(value, { stream: true });
        setThinking(content);
      }
    } catch {
      // 争执失败不影响主回答。
    }
  }

  async function send(text: string, opts: { hidden?: boolean } = {}) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const history = [...historyRef.current];
    if (!opts.hidden) {
      setMessages((current) => [...current, { role: "user", content: trimmed }]);
    }
    // 隐藏的开场独白不写入对话历史，存档时才不会混入一句「舞台指示」。
    historyRef.current = opts.hidden ? history : [...history, { role: "user", content: trimmed }];
    setInput("");
    setStreaming(true);
    setError("");

    const turn = ++turnRef.current;
    setThinking("");

    const locale = language === "zh" ? "zh-CN" : "en";
    const photoContext = {
      caption: photo.caption,
      reflections: reflections.map((r) => r.content),
      takenAt: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(photo.createdAt),
      description: descriptionRef.current,
    };

    // 出声思考：并行触发三重脑争执（仅真实用户发言；开场独白不触发）。
    if (!opts.hidden) {
      void runDeliberation(trimmed, photoContext, turn);
    }

    try {
      const res = await fetch("/api/flashback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, photoContext, history, thoughtId: thought?.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || t("flashbackError"));
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";
      let messageAdded = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        const snapshot = content;
        if (!messageAdded) {
          messageAdded = true;
          setMessages((current) => [...current, { role: "assistant", content: snapshot }]);
        } else {
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = { role: "assistant", content: snapshot };
            return next;
          });
        }
      }
      historyRef.current = [...historyRef.current, { role: "assistant", content }];
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages((current) => current.filter((m) => !(m.role === "assistant" && m.content === "")));
    } finally {
      setStreaming(false);
    }
  }

  // 封存对话：存档完整对话 + 提炼关键信息写回照片说明。
  async function sealDialogue() {
    if (sealingRef.current || streaming || sealed) return;
    const conversation = historyRef.current;
    const hasUserTurn = messages.some((m) => m.role === "user");
    if (!hasUserTurn) return;
    sealingRef.current = true;
    setSealing(true);
    setError("");
    try {
      await saveConversation({
        id: crypto.randomUUID(),
        photoId: photo.id,
        messages: conversation,
        createdAt: new Date(),
      });
      let summaryText = "";
      try {
        const res = await fetch("/api/flashback/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversation }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { summary?: string } | null;
          summaryText = data?.summary?.trim() || "";
        }
      } catch { /* 提炼失败不阻塞封存 */ }
      if (summaryText) {
        await appendPhotoCaption(photo.rollId, photo.id, summaryText);
        setSummary(summaryText);
      }
      setSealed(true);
    } catch {
      setError(t("flashbackSealError"));
    } finally {
      sealingRef.current = false;
      setSealing(false);
    }
  }

  // 关闭：有实质对话时静默存档（完整对话可查），不做提炼或写回。
  async function handleClose() {
    if (closingRef.current || streaming) return;
    closingRef.current = true;
    const conversation = historyRef.current;
    const hasUserTurn = messages.some((m) => m.role === "user");
    if (hasUserTurn && !sealed) {
      try {
        await saveConversation({
          id: crypto.randomUUID(),
          photoId: photo.id,
          messages: conversation,
          createdAt: new Date(),
        });
      } catch { /* 存档失败不阻塞关闭 */ }
    }
    onClose();
  }

  handleCloseRef.current = () => { void handleClose(); };

  // 闪回组件内部接管 ESC：输入法组合中不关闭；正常 ESC 走存档流程。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.isComposing) return;
      handleCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: unknown) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
      webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: unknown) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void };
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    finalTextRef.current = "";
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = language === "zh" ? "zh-CN" : "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: unknown) => {
      const e = event as { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) finalTextRef.current += final;
      setInput((finalTextRef.current + (interim ? ` ${interim}` : "")).trim());
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const spoken = finalTextRef.current.trim();
      finalTextRef.current = "";
      if (spoken) void send(spoken);
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
    setListening(true);
  }

  const showThinking = streaming || thinking.trim() !== "";
  const thinkingBlock = showThinking ? (
    <div className="flashback-thinking" aria-hidden="true">
      <span className="flashback-thinking-label">{t("flashbackThinking")}</span>
      {thinking.trim()
        ? parseSegments(thinking).map((seg, j) => (
            <p key={j} className={`flashback-seg ${voiceClass(seg.voice)}`}>
              <span className="flashback-voice-tag">{voiceLabel(seg.voice, language)}</span>
              {seg.text}
            </p>
          ))
        : <p className="flashback-typing">…</p>}
    </div>
  ) : null;

  return (
    <motion.div
      className="flashback-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("flashback")}
      onClick={(event) => { if (event.target === event.currentTarget) void handleClose(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flashback-chat">
        <header className="flashback-header">
          <div className="flashback-voice-title">
            <span className="flashback-voice-dot" />
            <strong>{language === "zh" ? "哺乳脑" : "LIMBIC BRAIN"}</strong>
            <small>{t("flashbackSubtitle")}</small>
            {thought && <small className="flashback-thought-tag">· {language === "zh" ? thought.name : thought.nameEn}</small>}
          </div>
          <button type="button" className="flashback-close" onClick={() => void handleClose()} aria-label={t("closeHint")}>×</button>
        </header>

        <div className="flashback-photo-ref">
          <BlobImage blob={photo.imageBlob} alt={photo.caption || "flashback"} />
          <div>
            <span>{t("flashbackOn")}</span>
            <p>{photo.caption || t("noCaption")}</p>
            <time>{new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { dateStyle: "long" }).format(photo.createdAt)}</time>
          </div>
        </div>

        <div className="flashback-messages" ref={scrollRef}>
          {messages.map((msg, i) => (
            <Fragment key={i}>
              {i === messages.length - 1 && msg.role === "assistant" && thinkingBlock}
              <div className={`flashback-msg ${msg.role === "user" ? "flashback-msg-user" : "flashback-msg-assistant"}`}>
                {msg.role === "assistant"
                  ? (msg.content.trim() === ""
                      ? <p className="flashback-typing" aria-label={t("flashbackOpening")}>…</p>
                      : parseSegments(msg.content).map((seg, j) => (
                          <p key={j} className={`flashback-seg ${voiceClass(seg.voice)}`}>
                            {seg.voice !== MAIN_VOICE && (
                              <span className="flashback-voice-tag">{voiceLabel(seg.voice, language)}</span>
                            )}
                            {seg.text}
                          </p>
                        )))
                  : <p>{msg.content}</p>}
              </div>
            </Fragment>
          ))}
          {messages[messages.length - 1]?.role !== "assistant" && thinkingBlock}
        </div>

        {error && <div className="flashback-error" role="alert">{error}</div>}

        <div className="flashback-footer">
          {sealed ? (
            <div className="flashback-confirm flashback-sealed" role="status" aria-live="polite">
              <p className="flashback-confirm-label">{t("flashbackSealedLabel")}</p>
              <p className="flashback-confirm-summary">{summary || t("flashbackSealedEmpty")}</p>
              <div className="flashback-confirm-actions">
                <button type="button" className="flashback-confirm-primary" onClick={onClose}>{t("flashbackSealedDone")}</button>
              </div>
            </div>
          ) : (
            <>
              <form className="flashback-input" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
                {voiceSupported && (
                  <button
                    type="button"
                    className={`flashback-mic ${listening ? "is-listening" : ""}`}
                    onClick={toggleVoice}
                    aria-label={t("flashbackVoice")}
                    disabled={streaming}
                  >
                    {listening ? t("flashbackVoiceStop") : t("flashbackVoice")}
                  </button>
                )}
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
                  placeholder={t("flashbackPlaceholder")}
                  disabled={streaming}
                  autoFocus
                />
                <button type="submit" disabled={!input.trim() || streaming}>{t("flashbackSend")}</button>
              </form>
              <div className="flashback-seal-bar">
                <button
                  type="button"
                  className="flashback-seal-button"
                  onClick={() => void sealDialogue()}
                  disabled={sealing || streaming || !messages.some((m) => m.role === "user")}
                >
                  {sealing ? t("flashbackSealing") : t("flashbackSeal")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
