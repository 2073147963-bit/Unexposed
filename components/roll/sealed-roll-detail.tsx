"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BlobImage } from "@/components/ui/blob-image";
import { FlashbackChat } from "@/components/roll/flashback-chat";
import { ConversationArchive } from "@/components/roll/conversation-archive";
import { useLanguage } from "@/components/ui/language-provider";
import { addDoubleExposure, getPhotoReflections, getRoll, getRollVersion } from "@/lib/db";
import { precomputePhoto } from "@/lib/describe-photo";
import type { HistoricalPhotoMemory, Reflection, RollVersion, StoredRoll } from "@/lib/types";

export function SealedRollDetail({ rollId }: { rollId: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const { language, t } = useLanguage();
  const [roll, setRoll] = useState<StoredRoll | null>(null);
  const [version, setVersion] = useState<RollVersion | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<HistoricalPhotoMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flashbackPhoto, setFlashbackPhoto] = useState<HistoricalPhotoMemory | null>(null);
  const [flashbackReflections, setFlashbackReflections] = useState<Reflection[]>([]);
  const [archivePhotoId, setArchivePhotoId] = useState<string | null>(null);
  const [redevelopMode, setRedevelopMode] = useState(false);
  const [redevelopPhoto, setRedevelopPhoto] = useState<HistoricalPhotoMemory | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [photoReflections, setPhotoReflections] = useState<Reflection[]>([]);
  const [reflectionRevealed, setReflectionRevealed] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRoll(rollId).then(async (storedRoll) => {
      if (!storedRoll || storedRoll.status !== "sealed") throw new Error("Roll not found");
      const historicalVersion = await getRollVersion(storedRoll.sealedVersionId);
      if (!historicalVersion) throw new Error("Historical record not found");
      if (!cancelled) { setRoll(storedRoll); setVersion(historicalVersion); }
    }).catch(() => { if (!cancelled) setError(t("missing")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rollId, t]);

  // 预热本地生成模型，消除首次进入闪回时的冷启动延迟（fire-and-forget）。
  useEffect(() => {
    void fetch("/api/flashback/warmup").catch(() => {});
  }, []);

  // 后台预热视觉模型 + 预描述本卷所有照片，把「显影」提前到浏览阶段，闪回打开即读缓存。
  useEffect(() => {
    if (!version) return;
    void fetch("/api/flashback/describe/warmup").catch(() => {});
    for (const photo of version.photos) {
      void precomputePhoto(photo, language).catch(() => {});
    }
  }, [version, language]);

  const returnOneLevel = useCallback(() => {
    if (flashbackPhoto) setFlashbackPhoto(null);
    else if (redevelopPhoto) { setRedevelopPhoto(null); setReflectionRevealed(false); setReflectionDraft(""); }
    else if (selectedPhoto) setSelectedPhoto(null);
    else if (redevelopMode) setRedevelopMode(false);
    else router.push("/");
  }, [flashbackPhoto, redevelopMode, redevelopPhoto, router, selectedPhoto]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (flashbackPhoto) return; // 闪回打开时 ESC 交给 FlashbackChat 内部处理（走存档流程）
        if (archivePhotoId) { setArchivePhotoId(null); return; }
        returnOneLevel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [returnOneLevel, flashbackPhoto, archivePhotoId]);

  async function requestFlashback(photo: HistoricalPhotoMemory) {
    setFlashbackReflections(await getPhotoReflections(photo.id));
    setFlashbackPhoto(photo);
    setSelectedPhoto(null); // 关闭底下的 lightbox，避免双层渲染导致交互冲突/闪退
  }

  async function chooseForRedevelopment(photo: HistoricalPhotoMemory) {
    setRedevelopPhoto(photo);
    setReflectionDraft("");
    setReflectionRevealed(false);
    setPhotoReflections(await getPhotoReflections(photo.id));
  }

  async function submitReflection() {
    if (!redevelopPhoto || !reflectionDraft.trim() || savingReflection) return;
    setSavingReflection(true);
    try {
      const reflection = await addDoubleExposure(redevelopPhoto.id, reflectionDraft);
      setPhotoReflections((current) => [...current, reflection].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
      setReflectionDraft("");
      setReflectionRevealed(true);
    } finally {
      setSavingReflection(false);
    }
  }

  if (loading) return <main className="reel-viewer centered">{t("opening")}</main>;
  if (error || !roll || !version) return <main className="reel-viewer centered"><section className="missing-roll"><p>{error || t("missing")}</p><Link href="/">{t("backDesk")}</Link></section></main>;

  const locale = language === "zh" ? "zh-CN" : "en";
  const thenYear = version.createdAt.getFullYear();

  return (
    <main className="reel-viewer" onClick={(event) => { if (event.target === event.currentTarget) returnOneLevel(); }}>
      <header className="reel-viewer-header">
        <Link href="/">← {t("backDesk")}</Link>
        <div><span>{t("then")} — {thenYear}</span><strong>{version.title}</strong><small>{version.theme}</small></div>
        <button className={`redevelop-entry ${redevelopMode ? "active" : ""}`} type="button" onClick={() => setRedevelopMode((current) => !current)}>{redevelopMode ? t("chooseExposure") : t("redevelop")}</button>
      </header>

      <motion.section className="horizontal-reel" aria-label={`${version.title}, ${t("rollLabel")}`}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: "easeOut" }}>
        <div className="reel-canister" aria-hidden="true"><span /><strong>{version.title}</strong><b>400</b></div>
        <motion.div className="horizontal-film-reveal"
          initial={reduceMotion ? false : { clipPath: "inset(0 100% 0 0)", x: -24 }}
          animate={{ clipPath: "inset(0 0% 0 0)", x: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.48, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}>
          <div className="horizontal-film-strip">
            {version.photos.map((photo, index) => (
              <article className="horizontal-exposure" key={photo.id}>
                <button type="button" className={`exposure-frame ${redevelopMode ? "redevelop-selectable" : ""}`}
                  onClick={() => { if (redevelopMode) void chooseForRedevelopment(photo); }}
                  onDoubleClick={() => { if (!redevelopMode) setSelectedPhoto(photo); }}
                  aria-label={`${language === "zh" ? "放大胶片" : "Enlarge frame"} ${index + 1}`}>
                  <BlobImage blob={photo.imageBlob} alt={`${version.title}, ${String(index + 1).padStart(2, "0")}`} />
                </button>
                <div className="exposure-record">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{photo.caption || t("noCaption")}</p>
                  <time dateTime={photo.createdAt.toISOString()}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(photo.createdAt)}</time>
                </div>
              </article>
            ))}
            <div className="film-tail">UNEXPOSED · {version.photos.length} EXP · C–41</div>
          </div>
        </motion.div>
      </motion.section>
      <p className="reel-scroll-hint">{t("openHint")}</p>

      <AnimatePresence>
        {selectedPhoto && (
          <motion.div className="frame-lightbox" role="dialog" aria-modal="true" aria-label={t("reflection")}
            onClick={(event) => { if (event.target === event.currentTarget) setSelectedPhoto(null); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.div className="enlarged-frame" initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.24 }}>
              <div className="enlarged-negative"><BlobImage blob={selectedPhoto.imageBlob} alt={version.title} /></div>
              <aside className="frame-note">
                <span>{t("reflection")}</span><p>{selectedPhoto.caption || t("noCaption")}</p>
                <time>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(selectedPhoto.createdAt)}</time>
                <div className="frame-note-actions">
                  <button type="button" onClick={() => requestFlashback(selectedPhoto)}>{t("flashback")}</button>
                  <button type="button" onClick={() => setArchivePhotoId(selectedPhoto.id)}>{t("viewConversations")}</button>
                </div>
              </aside>
            </motion.div>
            <p className="lightbox-hint">{t("closeHint")}</p>
          </motion.div>
        )}
        {redevelopPhoto && (
          <motion.div className="frame-lightbox" role="dialog" aria-modal="true" aria-label={t("redevelop")}
            onClick={(event) => { if (event.target === event.currentTarget) returnOneLevel(); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.div className="enlarged-frame redevelop-frame" initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.24 }}>
              <div className="enlarged-negative"><BlobImage blob={redevelopPhoto.imageBlob} alt={version.title} /></div>
              <aside className="frame-note redevelop-note-panel">
                {!reflectionRevealed ? (
                  <form onSubmit={(event) => { event.preventDefault(); void submitReflection(); }}>
                    <span>{t("nowRecord")}</span>
                    <h2>{t("redevelopPrompt")}</h2>
                    <textarea autoFocus value={reflectionDraft} onChange={(event) => setReflectionDraft(event.target.value)} placeholder={t("writingNow")} maxLength={1200} />
                    <button type="submit" disabled={!reflectionDraft.trim() || savingReflection}>{t("submitReflection")}</button>
                  </form>
                ) : (
                  <div className="reflection-history" aria-live="polite">
                    <section><span>{t("thenRecord")} — {redevelopPhoto.createdAt.getFullYear()}</span><p>{redevelopPhoto.caption || t("nothingThen")}</p><time>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(redevelopPhoto.createdAt)}</time></section>
                    {photoReflections.map((reflection) => (
                      <section key={reflection.id}><span>{t("nowRecord")} — {reflection.createdAt.getFullYear()}</span><p>{reflection.content}</p><time>{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(reflection.createdAt)}</time></section>
                    ))}
                    <small role="status">{t("reflectionSaved")}</small>
                    <button type="button" onClick={() => { setReflectionRevealed(false); setReflectionDraft(""); }}>{t("redevelop")}</button>
                  </div>
                )}
              </aside>
            </motion.div>
            <p className="lightbox-hint">{t("closeHint")}</p>
          </motion.div>
        )}
        {flashbackPhoto && (
          <FlashbackChat
            photo={flashbackPhoto}
            reflections={flashbackReflections}
            onClose={() => setFlashbackPhoto(null)}
          />
        )}
        {archivePhotoId && (
          <ConversationArchive photoId={archivePhotoId} onClose={() => setArchivePhotoId(null)} />
        )}
      </AnimatePresence>
    </main>
  );
}
