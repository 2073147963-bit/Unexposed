"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";

import { ProgressiveDesk } from "@/components/desk/progressive-desk";
import { BlobImage } from "@/components/ui/blob-image";
import { useLanguage } from "@/components/ui/language-provider";
import { useSound } from "@/components/sound/sound-provider";
import { getActiveDraft, getSealedRolls, saveRoll, sealRollRecord } from "@/lib/db";
import { precomputePhoto } from "@/lib/describe-photo";
import type { PhotoMemory, RollStep, StoredRoll } from "@/lib/types";

const themes = [
  "A person",
  "A place",
  "Something ordinary",
  "Something I almost missed",
  "No theme",
] as const;

function makeRoll(title: string, theme: string): StoredRoll {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    theme,
    createdAt: new Date(),
    sealedAt: null,
    coverPhotoId: null,
    photos: [],
    reflections: [],
    sealed: false,
    sealedVersionId: null,
    status: "draft",
    step: "photos",
  };
}

function withPositions(photos: PhotoMemory[]) {
  return photos.map((photo, index) => ({
    ...photo,
    position: (index + 1) as 1 | 2 | 3,
  }));
}

function VoiceNote({
  blob,
  onChange,
}: {
  blob?: Blob;
  onChange: (blob?: Blob) => void;
}) {
  const { language } = useLanguage();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => {
    if (!blob) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(
    () => () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const nextBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (nextBlob.size) onChange(nextBlob);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone permission was not granted.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  return (
    <div className="voice-note">
      <button
        type="button"
        className="text-button"
        onClick={recording ? stopRecording : startRecording}
      >
        {recording ? (language === "zh" ? "停止录音" : "Stop recording") : blob ? (language === "zh" ? "重新录音" : "Record again") : (language === "zh" ? "添加语音记录" : "Add voice note")}
      </button>
      {audioUrl && <audio controls src={audioUrl} aria-label="Recorded voice note" />}
      {blob && (
        <button type="button" className="text-button danger" onClick={() => onChange()}>
          {language === "zh" ? "删除语音记录" : "Remove voice note"}
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function NewRollFlow() {
  const { language, t } = useLanguage();
  const { playSound } = useSound();
  const zh = language === "zh";
  const [roll, setRoll] = useState<StoredRoll | null>(null);
  const [activeDraft, setActiveDraft] = useState<StoredRoll | null>(null);
  const [sealedRolls, setSealedRolls] = useState<StoredRoll[]>([]);
  const [view, setView] = useState<"desk" | "flow" | "success">("desk");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<(typeof themes)[number]>("No theme");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const replaceInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    Promise.all([getActiveDraft(), getSealedRolls()])
      .then(([draft, storedRolls]) => {
        if (!cancelled) {
          setRoll(draft ?? null);
          setActiveDraft(draft ?? null);
          setSealedRolls(storedRolls);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Local storage could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function commit(nextRoll: StoredRoll) {
    setRoll(nextRoll);
    if (nextRoll.status === "draft") setActiveDraft(nextRoll);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveRoll(nextRoll))
      .catch(() => {
        setMessage("This change could not be saved locally. Please try again.");
      });
    return saveQueue.current;
  }

  async function createRoll() {
    if (!title.trim()) return;
    setMessage("");
    await commit(makeRoll(title, theme));
  }

  function imageFiles(files: File[]) {
    return files.filter((file) => file.type.startsWith("image/"));
  }

  async function addFiles(files: File[]) {
    if (!roll) return;
    const validFiles = imageFiles(files);
    if (validFiles.length !== files.length) {
      setMessage("Only image files are accepted.");
    }
    const available = 3 - roll.photos.length;
    if (available === 0) {
      setMessage("A roll can contain exactly three photos. Replace or remove one first.");
      return;
    }
    if (validFiles.length > available) {
      setMessage(`Only ${available} more photo${available === 1 ? "" : "s"} can be added.`);
    }
    const additions = validFiles.slice(0, available).map<PhotoMemory>((file, index) => ({
      id: crypto.randomUUID(),
      rollId: roll.id,
      imageBlob: file,
      createdAt: new Date(),
      caption: "",
      position: (roll.photos.length + index + 1) as 1 | 2 | 3,
    }));
    if (additions.length) {
      await commit({ ...roll, photos: [...roll.photos, ...additions] });
    }
  }

  async function replacePhoto(photoId: string, files: FileList | null) {
    if (!roll || !files?.[0]) return;
    const [file] = Array.from(files);
    if (!file.type.startsWith("image/")) {
      setMessage("Only image files are accepted.");
      return;
    }
    const photos = roll.photos.map((photo) =>
      photo.id === photoId
        ? { ...photo, imageBlob: file, createdAt: new Date() }
        : photo,
    );
    await commit({ ...roll, photos });
  }

  async function removePhoto(photoId: string) {
    if (!roll) return;
    await commit({
      ...roll,
      photos: withPositions(roll.photos.filter((photo) => photo.id !== photoId)),
    });
  }

  async function movePhoto(from: number, to: number) {
    if (!roll || to < 0 || to >= roll.photos.length || from === to) return;
    const photos = [...roll.photos];
    const [moved] = photos.splice(from, 1);
    photos.splice(to, 0, moved);
    await commit({ ...roll, photos: withPositions(photos) });
  }

  async function dropOn(photoId: string) {
    if (!roll || !draggedId || draggedId === photoId) return;
    await movePhoto(
      roll.photos.findIndex((photo) => photo.id === draggedId),
      roll.photos.findIndex((photo) => photo.id === photoId),
    );
    setDraggedId(null);
  }

  async function updatePhoto(photoId: string, changes: Partial<PhotoMemory>) {
    if (!roll) return;
    await commit({
      ...roll,
      photos: roll.photos.map((photo) =>
        photo.id === photoId ? { ...photo, ...changes } : photo,
      ),
    });
  }

  async function goTo(step: RollStep) {
    if (!roll) return;
    setMessage("");
    await commit({ ...roll, step });
  }

  async function sealRoll() {
    if (!roll || roll.photos.length !== 3 || roll.sealed || sealing) return;
    setSealing(true);
    setMessage("");
    try {
      await saveQueue.current;
      const sealedRoll = await sealRollRecord(roll);
      playSound("sealRoll");
      setRoll(sealedRoll);
      setActiveDraft(null);
      setSealedRolls((current) => [sealedRoll, ...current.filter((item) => item.id !== sealedRoll.id)]);
      // 封存后直接回到桌面，让新胶卷掉落在桌子上，而不是停在成功页。
      setView("desk");
      // 后台为三张照片生成「视觉描述 + 开场独白」（fire-and-forget），把「显影」提前到封存时，闪回打开即读缓存秒开。
      for (const photo of sealedRoll.photos) {
        void precomputePhoto(photo, language).catch(() => {});
      }
    } catch {
      setMessage("The roll could not be sealed locally. Nothing was changed.");
    } finally {
      setSealing(false);
    }
  }

  function startAnotherRoll() {
    setRoll(null);
    setTitle("");
    setTheme("No theme");
    setMessage("");
    setView("flow");
  }

  function openNewRoll() {
    if (activeDraft) {
      setRoll(activeDraft);
      setView("flow");
      return;
    }
    startAnotherRoll();
  }

  if (loading) {
    return <main className="desk centered">{t("loading")}</main>;
  }

  if (view === "desk") {
    return <ProgressiveDesk rolls={sealedRolls} onNewRoll={openNewRoll} />;
  }

  if (view === "flow" && !roll) {
    return (
      <main className="shell centered">
        <p className="eyebrow">UNEXPOSED</p>
        <section className="panel narrow" aria-labelledby="new-roll-title">
          <p className="step-label">{zh ? "第 1 / 3 步" : "Step 1 of 3"}</p>
          <h1 id="new-roll-title">{zh ? "创建一卷新胶卷" : "Create a new roll"}</h1>
          <label>
            {zh ? "胶卷标题" : "Roll title"}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Roll 001"
              autoFocus
            />
          </label>
          <label>
            {zh ? "主题" : "Theme"} <span className="optional">{zh ? "可选" : "optional"}</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as (typeof themes)[number])}
            >
              {themes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="primary" type="button" disabled={!title.trim()} onClick={createRoll}>
            {zh ? "选择照片" : "Choose photos"}
          </button>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  if (view === "success" && roll?.status === "sealed") {
    return (
      <main className="shell centered">
        <motion.section
          className="panel narrow sealed-state"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <p className="eyebrow">{zh ? "已封存" : "SEALED"}</p>
          <h1>{zh ? "胶卷已封存" : "ROLL SEALED"}</h1>
          <p>{zh ? `${roll.title} 已安全保存在此浏览器中。` : `${roll.title} is safely stored in this browser.`}</p>
          <button className="primary" type="button" onClick={() => setView("desk")}>
            {t("backDesk")}
          </button>
        </motion.section>
      </main>
    );
  }

  if (!roll) return null;

  return (
    <main className="shell">
      <header className="flow-header">
        <div>
          <p className="eyebrow">UNEXPOSED</p>
          <h1>{roll.title}</h1>
          <p className="muted">{roll.theme}</p>
        </div>
        <p className="count" aria-live="polite">{roll.photos.length} / 3 {zh ? "张照片" : "photos"}</p>
      </header>

      {roll.step === "photos" && (
        <section className="panel" aria-labelledby="choose-heading">
          <p className="step-label">{zh ? "第 2 / 3 步" : "Step 2 of 3"}</p>
          <h2 id="choose-heading">{zh ? "选择恰好三张照片" : "Choose exactly three photos"}</h2>
          <p className="muted">{zh ? "将图片拖到这里，或从设备中选择。" : "Drag image files here, or choose them from your device."}</p>

          <label
            className={`drop-zone ${roll.photos.length === 3 ? "disabled" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLLabelElement>) => {
              event.preventDefault();
              void addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={roll.photos.length === 3}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            {roll.photos.length === 3 ? (zh ? "已选择三张照片" : "Three photos selected") : (zh ? "拖入图片或点击上传" : "Drop images or click to upload")}
          </label>

          <div className="photo-grid">
            {roll.photos.map((photo, index) => (
              <article
                className="photo-card"
                key={photo.id}
                draggable
                onDragStart={() => setDraggedId(photo.id)}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void dropOn(photo.id);
                }}
              >
                <span className="photo-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="image-frame">
                  <BlobImage blob={photo.imageBlob} alt={`Selected photo ${index + 1}`} />
                </div>
                <div className="photo-actions">
                  <button type="button" onClick={() => movePhoto(index, index - 1)} disabled={index === 0}>
                    {zh ? "左移" : "Move left"}
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(index, index + 1)}
                    disabled={index === roll.photos.length - 1}
                  >
                    {zh ? "右移" : "Move right"}
                  </button>
                  <button type="button" onClick={() => replaceInputs.current[photo.id]?.click()}>
                    {zh ? "替换" : "Replace"}
                  </button>
                  <input
                    ref={(node) => {
                      replaceInputs.current[photo.id] = node;
                    }}
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      void replacePhoto(photo.id, event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button className="danger" type="button" onClick={() => removePhoto(photo.id)}>
                    {zh ? "删除" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {message && <p className="notice" role="status">{message}</p>}
          <div className="footer-actions">
            <button type="button" onClick={() => goTo("details")}>{zh ? "返回" : "Back"}</button>
            <button
              className="primary"
              type="button"
              disabled={roll.photos.length !== 3}
              onClick={() => goTo("reflections")}
            >
              {zh ? "添加说明" : "Add reflections"}
            </button>
          </div>
        </section>
      )}

      {roll.step === "details" && (
        <section className="panel narrow">
          <p className="step-label">{zh ? "第 1 / 3 步" : "Step 1 of 3"}</p>
          <h2>{zh ? "编辑胶卷信息" : "Edit roll details"}</h2>
          <label>
            {zh ? "胶卷标题" : "Roll title"}
            <input
              value={roll.title}
              onChange={(event) => commit({ ...roll, title: event.target.value })}
            />
          </label>
          <label>
            {zh ? "主题" : "Theme"} <span className="optional">{zh ? "可选" : "optional"}</span>
            <select
              value={roll.theme}
              onChange={(event) => commit({ ...roll, theme: event.target.value })}
            >
              {themes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="primary" type="button" disabled={!roll.title.trim()} onClick={() => goTo("photos")}>
            {zh ? "选择照片" : "Choose photos"}
          </button>
        </section>
      )}

      {roll.step === "reflections" && (
        <section className="panel" aria-labelledby="reflection-heading">
          <p className="step-label">{zh ? "第 3 / 3 步" : "Step 3 of 3"}</p>
          <h2 id="reflection-heading">{zh ? "为什么留下它们？" : "Why keep these?"}</h2>
          <p className="muted">{zh ? "每条说明都可以跳过。" : "Each reflection is optional."}</p>
          <div className="reflection-list">
            {roll.photos.map((photo, index) => (
              <article className="reflection-card" key={photo.id}>
                <div className="reflection-image">
                  <span className="photo-number">{String(index + 1).padStart(2, "0")}</span>
                  <BlobImage blob={photo.imageBlob} alt={`Selected photo ${index + 1}`} />
                </div>
                <div className="reflection-inputs">
                  <label>
                    {zh ? "为什么留下这一张？" : "Why keep this one?"}
                    <input
                      value={photo.caption}
                      maxLength={160}
                      placeholder={zh ? "可以跳过" : "You can skip this"}
                      onChange={(event) => updatePhoto(photo.id, { caption: event.target.value })}
                    />
                  </label>
                  <VoiceNote
                    blob={photo.voiceNoteBlob}
                    onChange={(voiceNoteBlob) => updatePhoto(photo.id, { voiceNoteBlob })}
                  />
                </div>
              </article>
            ))}
          </div>
          {message && <p className="notice" role="status">{message}</p>}
          <div className="footer-actions">
            <button type="button" onClick={() => goTo("photos")}>{zh ? "返回" : "Back"}</button>
            <button
              className="primary"
              type="button"
              disabled={roll.photos.length !== 3}
              onClick={() => goTo("preview")}
            >
              {zh ? "预览胶卷" : "Review Roll"}
            </button>
          </div>
        </section>
      )}

      {roll.step === "preview" && (
        <section className="panel preview" aria-labelledby="preview-heading">
          <p className="step-label">{zh ? "预览" : "Preview"}</p>
          <div className="preview-header">
            <div>
              <h2 id="preview-heading">{roll.title}</h2>
              <p>{roll.theme}</p>
            </div>
            <time dateTime={roll.createdAt.toISOString()}>
              {new Intl.DateTimeFormat(zh ? "zh-CN" : "en", { dateStyle: "long" }).format(roll.createdAt)}
            </time>
          </div>

          <div className="contact-sheet">
            {roll.photos.map((photo, index) => (
              <article className="contact-frame" key={photo.id}>
                <span className="photo-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="contact-image">
                  <BlobImage blob={photo.imageBlob} alt={`Preview photo ${index + 1}`} />
                </div>
                <p>{photo.caption || <span className="muted">{zh ? "无说明" : "No caption"}</span>}</p>
              </article>
            ))}
          </div>

          <p className="history-note">
            {zh ? "封存后，这三张照片、说明和创建时间将成为不可覆盖的历史记录。未来的反思会以新版本添加。" : "Once sealed, these three photos, captions, and their creation times become a historical record. Future reflections will be added as new versions."}
          </p>
          {message && <p className="notice" role="alert">{message}</p>}
          <div className="footer-actions">
            <button type="button" disabled={sealing} onClick={() => goTo("reflections")}>{zh ? "返回" : "Back"}</button>
            <button
              className="primary"
              type="button"
              disabled={roll.photos.length !== 3 || sealing}
              onClick={sealRoll}
            >
              {sealing ? (zh ? "正在封存…" : "Sealing…") : (zh ? "封存胶卷" : "Seal the Roll")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
