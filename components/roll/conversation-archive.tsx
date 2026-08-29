"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/ui/language-provider";
import { MAIN_VOICE, parseSegments, voiceClass, voiceLabel } from "@/components/roll/flashback-chat";
import { getPhotoConversations } from "@/lib/db";
import type { ConversationRecord } from "@/lib/types";

// 已封存对话的查看器：列出这张照片的所有闪回对话，点开可逐条查看完整内容。
export function ConversationArchive({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const { language, t } = useLanguage();
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPhotoConversations(photoId)
      .then((items) => { if (!cancelled) setRecords(items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [photoId]);

  const locale = language === "zh" ? "zh-CN" : "en";

  return (
    <motion.div
      className="conversation-archive-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("viewConversations")}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="conversation-archive">
        <header className="conversation-archive-header">
          <strong>{t("conversationArchiveTitle")}</strong>
          <button type="button" onClick={onClose} aria-label={t("closeHint")}>×</button>
        </header>
        <div className="conversation-archive-list">
          {loading ? (
            <p className="conversation-archive-empty">{t("loading")}</p>
          ) : records.length === 0 ? (
            <p className="conversation-archive-empty">{t("conversationEmpty")}</p>
          ) : (
            records.map((record) => (
              <section className="conversation-record" key={record.id}>
                <button
                  type="button"
                  className="conversation-record-head"
                  onClick={() => setOpenId(openId === record.id ? null : record.id)}
                >
                  <time>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(record.createdAt)}</time>
                  <span>{record.messages.filter((m) => m.role === "user").length} {language === "zh" ? "轮" : "turns"}</span>
                </button>
                {openId === record.id && (
                  <div className="conversation-record-body">
                    {record.messages.map((msg, i) => msg.role === "user" ? (
                      <p key={i} className="conversation-user-line"><span>{t("conversationYou")}</span>{msg.content}</p>
                    ) : (
                      parseSegments(msg.content).map((seg, j) => (
                        <p key={`${i}-${j}`} className={`conversation-seg ${voiceClass(seg.voice)}`}>
                          {seg.voice !== MAIN_VOICE && <span className="flashback-voice-tag">{voiceLabel(seg.voice, language)}</span>}
                          {seg.text}
                        </p>
                      ))
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
