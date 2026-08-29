"use client";

import { useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { FilmCanister } from "@/components/desk/film-canister";
import { useCanisterPhysics } from "@/components/desk/use-canister-physics";
import type { StoredRoll } from "@/lib/types";
import { useLanguage } from "@/components/ui/language-provider";
import { useSound } from "@/components/sound/sound-provider";

interface DeskProps {
  rolls: StoredRoll[];
  onNewRoll: () => void;
}

export function Desk({ rolls, onNewRoll }: DeskProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { playSound } = useSound();
  const tableRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const physics = useCanisterPhysics({
    ids: rolls.map((roll) => roll.id),
    containerRef: tableRef,
    reducedMotion: prefersReducedMotion,
  });

  const openReel = useCallback((canisterId: string) => {
    playSound("openRoll");
    router.push(`/roll/${encodeURIComponent(canisterId)}`);
  }, [playSound, router]);

  const readyRoll = physics.focusedId ? rolls.find((roll) => roll.id === physics.focusedId) : undefined;

  useEffect(() => {
    if (physics.focusMode !== "ready" || !readyRoll) return;
    const timer = window.setTimeout(() => openReel(readyRoll.id), prefersReducedMotion ? 80 : 260);
    return () => window.clearTimeout(timer);
  }, [physics.focusMode, readyRoll, prefersReducedMotion, openReel]);

  return (
    <main className={`immersive-home ${physics.focusedId ? "has-focus" : ""}`}>
      <div className="cinema-matte" aria-hidden="true" />
      <section className="physics-desk" aria-label={t("deskLabel")}>
        <div className="desk-metadata" aria-hidden="true">
          <span>UNEXPOSED / TABLE</span>
          <span>{String(rolls.length).padStart(2, "0")} {t("sealedRolls")}</span>
        </div>

        <div className="physics-surface" ref={tableRef}>
          {rolls.length === 0 ? (
            <div className="physics-empty-state">
              <p>{t("empty")}</p>
              <button type="button" onClick={onNewRoll}>{t("start")}</button>
            </div>
          ) : (
            rolls.map((roll) => (
              <FilmCanister
                key={roll.id}
                roll={roll}
                pose={physics.poses[roll.id]}
                interaction={physics.states[roll.id] ?? "idle"}
                focused={physics.focusedId === roll.id}
                focusMode={physics.focusMode}
                reducedMotion={prefersReducedMotion}
                handlers={physics.handlersFor(roll.id)}
              />
            ))
          )}
        </div>

        <button className="physical-new-roll" type="button" onClick={onNewRoll} disabled={Boolean(physics.focusedId)}>
          {t("newRoll")}
        </button>

        <p className="physical-desk-hint">{t("deskHint")}</p>

        {physics.focusedId && (
          <div className="focus-layer" aria-live="polite">
            <button className="focus-return" type="button" onClick={physics.cancelFocus}>
              {t("returnTable")}
            </button>
            {physics.focusMode === "ready" && readyRoll && (
              <p className="ready-message">
                {t("ready")} / {readyRoll.title}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
