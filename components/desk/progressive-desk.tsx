"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useState } from "react";

import { Desk } from "@/components/desk/desk";
import { useSound } from "@/components/sound/sound-provider";
import type { StoredRoll } from "@/lib/types";

const ThreeDeskScene = dynamic(
  () => import("@/components/desk/three-desk-scene").then((module) => module.ThreeDeskScene),
  { ssr: false, loading: () => null },
);

interface ProgressiveDeskProps { rolls: StoredRoll[]; onNewRoll: () => void }

class ThreeDeskBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const extension = context?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(context);
  } catch { return false; }
}

export function ProgressiveDesk(props: ProgressiveDeskProps) {
  const { audioReady, playSound, stopSound } = useSound();
  const [capable, setCapable] = useState(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    setReducedMotion(media.matches);
    setCapable(!mobile.matches && supportsWebGL() && props.rolls.length > 0);
  }, [props.rolls.length]);

  useEffect(() => {
    if (audioReady) playSound("deskRoomTone");
    return () => stopSound("deskRoomTone");
  }, [audioReady, playSound, stopSound]);

  const fail = useCallback(() => { setReady(false); setCapable(false); }, []);
  const markReady = useCallback(() => setReady(true), []);

  return (
    <div className="progressive-desk-root">
      {!ready && <Desk {...props} />}
      {capable && (
        <ThreeDeskBoundary onFailure={fail}>
          <ThreeDeskScene {...props} reducedMotion={reducedMotion} onReady={markReady} onFailure={fail} />
        </ThreeDeskBoundary>
      )}
    </div>
  );
}
