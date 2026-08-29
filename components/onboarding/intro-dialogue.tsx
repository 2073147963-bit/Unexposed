"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLanguage } from "@/components/ui/language-provider";
import { useSound } from "@/components/sound/sound-provider";
import {
  INTRO_BRAIN_NAMES,
  INTRO_ENDLINE,
  INTRO_FIRST_LINE,
  INTRO_STEPS,
} from "@/lib/config/intro-dialogue";

// 开场对话：纯黑背景，点击逐句推进，结束（或跳过）进入桌面。
// 呈现方式固定为「英文电报字体台词居中 + 中文翻译字幕固定在画面最下方」。
// 脑名独立一行、英文；说话主体不变时脑名保持不淡出，仅句子淡入淡出。
// 中文脑名归入底部中文翻译字幕；首句与旁白的中文字幕用斜体。
export function IntroDialogue({ onComplete }: { onComplete: () => void }) {
  const { language } = useLanguage();
  const reduceMotion = useReducedMotion() ?? false;
  const { audioReady, playSound, stopSound } = useSound();
  const [index, setIndex] = useState(0);
  const leavingRef = useRef(false);

  const zh = language === "zh";
  const step = index < INTRO_STEPS.length ? INTRO_STEPS[index] : null;
  const isLast = index === INTRO_STEPS.length - 1;
  const brain = step?.kind === "line" ? step.brain : null;

  // 首句英文：在第一个逗号处手动换行。
  const [firstEnLine1, firstEnLine2] = INTRO_FIRST_LINE.en.split(", ");

  // 中文翻译字幕：台词步带中文脑名前缀，其余步仅中文译文。
  const subtitleText = (() => {
    if (!step) return "";
    switch (step.kind) {
      case "first": return INTRO_FIRST_LINE.zh;
      case "direction": return step.zh;
      case "line": return `${INTRO_BRAIN_NAMES[step.brain].zh} — ${step.zh}`;
      case "ending": return INTRO_ENDLINE.zh;
    }
  })();

  // 字幕样式：首句斜体；旁白斜体且颜色与英文旁白一致。
  const subtitleClass = (() => {
    if (!step) return "intro-dialogue-subtitle";
    switch (step.kind) {
      case "first": return "intro-dialogue-subtitle intro-dialogue-subtitle-italic";
      case "direction": return "intro-dialogue-subtitle intro-dialogue-subtitle-direction";
      default: return "intro-dialogue-subtitle";
    }
  })();

  // 开场呼吸声（脚本开头的「远处传来极轻的呼吸声」）。
  useEffect(() => {
    if (audioReady) playSound("breathing");
    return () => stopSound("breathing");
  }, [audioReady, playSound, stopSound]);

  const finish = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    stopSound("breathing");
    onComplete();
  }, [onComplete, stopSound]);

  const advance = useCallback(() => {
    if (isLast) { finish(); return; }
    setIndex((i) => i + 1);
  }, [isLast, finish]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // 键盘导航：方向键右/下、空格、回车前进；左/上返回；ESC 跳过开场。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") { finish(); return; }
      if (["ArrowRight", "ArrowDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        advance();
      } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, finish]);

  // 鼠标滚轮导航：下滚前进、上滚返回。加冷却，避免一次滚动翻多页。
  const wheelLockRef = useRef(0);
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (leavingRef.current) return;
      const now = performance.now();
      if (now - wheelLockRef.current < 420) return;
      if (event.deltaY > 0) { wheelLockRef.current = now; advance(); }
      else if (event.deltaY < 0) { wheelLockRef.current = now; back(); }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [advance, back]);

  const fade = reduceMotion ? { duration: 0.05 } : { duration: 0.34 };

  return (
    <motion.div
      className="intro-dialogue"
      role="dialog"
      aria-modal="true"
      aria-label="UNEXPOSED — 开场"
      onClick={advance}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.05 : 0.5 }}
    >
      <button
        className="intro-dialogue-skip"
        type="button"
        onClick={(event) => { event.stopPropagation(); finish(); }}
      >
        {zh ? "跳过" : "Skip"}
      </button>

      <div className="intro-dialogue-stage">
        {/* 脑名标签：独立一行；说话主体不变时 key 不变 → 不淡出、位置保持。 */}
        <AnimatePresence mode="wait" initial={false}>
          {brain && (
            <motion.div
              key={`name-${brain}`}
              className="intro-dialogue-name"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <span className={`intro-dialogue-name-text intro-name-${brain}`}>{INTRO_BRAIN_NAMES[brain].en}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="intro-dialogue-content">
          <AnimatePresence mode="wait" initial={false}>
            {step?.kind === "first" && (
              <motion.div
                key="first"
                className="intro-dialogue-first"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
              >
                <p className="intro-dialogue-first-en">
                  {firstEnLine1},<br />{firstEnLine2}
                </p>
                <p className="intro-dialogue-first-attr">{INTRO_FIRST_LINE.attribution}</p>
              </motion.div>
            )}

            {step?.kind === "direction" && (
              <motion.p
                key={`direction-${index}`}
                className="intro-dialogue-direction"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
              >
                {step.en}
              </motion.p>
            )}

            {step?.kind === "line" && (
              <motion.p
                key={`line-${index}`}
                className="intro-dialogue-text"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={fade}
              >
                {step.en}
              </motion.p>
            )}

            {step?.kind === "ending" && (
              <motion.div
                key="ending"
                className="intro-dialogue-ending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
              >
                <p className="intro-dialogue-ending-brand">未显影 · UNEXPOSED</p>
                <p className="intro-dialogue-ending-line">{INTRO_ENDLINE.en}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {subtitleText && (
          <motion.p
            key={`sub-${index}`}
            className={subtitleClass}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            {subtitleText}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="intro-dialogue-hint">{zh ? "点击 · 方向键 · 滚轮 翻页" : "CLICK · ARROWS · SCROLL"}</p>
    </motion.div>
  );
}
