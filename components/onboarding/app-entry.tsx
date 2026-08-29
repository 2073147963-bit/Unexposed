"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { IntroDialogue } from "@/components/onboarding/intro-dialogue";
import { NewRollFlow } from "@/components/roll/new-roll-flow";
import { INTRO_DIALOGUE_KEY, INTRO_DIALOGUE_VERSION, INTRO_DIALOGUE_VERSION_KEY } from "@/lib/config/intro-dialogue";

type Gate = "loading" | "intro" | "app";

// 应用入口：先播放「三重脑」开场对话（叠加在桌面背景之上），结束后进入桌面。
// 开场按版本号 gating——已看过当前版本则直接进桌面；跳过/播放完都写入 localStorage。
export function AppEntry() {
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    const seen = window.localStorage.getItem(INTRO_DIALOGUE_KEY) === "true";
    const current = window.localStorage.getItem(INTRO_DIALOGUE_VERSION_KEY) === INTRO_DIALOGUE_VERSION;
    setGate(seen && current ? "app" : "intro");
  }, []);

  function completeIntro() {
    window.localStorage.setItem(INTRO_DIALOGUE_KEY, "true");
    window.localStorage.setItem(INTRO_DIALOGUE_VERSION_KEY, INTRO_DIALOGUE_VERSION);
    setGate("app");
  }

  if (gate === "loading") return <main className="onboarding-boot" aria-label="Loading" />;

  return (
    <>
      <NewRollFlow />
      <AnimatePresence>
        {gate === "intro" && <IntroDialogue onComplete={completeIntro} />}
      </AnimatePresence>
    </>
  );
}
