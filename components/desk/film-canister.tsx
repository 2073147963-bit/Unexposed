"use client";

import { motion } from "framer-motion";

import type { CanisterInteractionState, CanisterPose } from "@/components/desk/use-canister-physics";
import type { StoredRoll } from "@/lib/types";
import { stableHash } from "@/lib/utils/desk-placement";

const tones = ["mustard", "red", "ivory", "green"] as const;

export function FilmCanister({ roll, pose, interaction, focused, focusMode, reducedMotion, handlers }: {
  roll: StoredRoll;
  pose?: CanisterPose;
  interaction: CanisterInteractionState;
  focused: boolean;
  focusMode: "focusing" | "ready" | "returning" | null;
  reducedMotion: boolean;
  handlers: Record<string, unknown>;
}) {
  const tone = tones[stableHash(roll.id) % tones.length];
  const focusActive = focused && focusMode !== "returning";
  const style = focusActive
    ? { left: "50%", top: "50%", transform: "translate(-50%, -50%) rotate(0deg) scale(1.12)" }
    : { left: pose?.x ?? 0, top: pose?.y ?? 0, transform: `translate(-50%, -50%) rotate(${pose?.angle ?? 0}rad)` };

  return (
    <button
      type="button"
      className={`physics-canister canister-tone-${tone} is-${interaction} ${focused ? `focus-${focusMode}` : ""}`}
      style={style}
      aria-label={`${roll.title}, sealed film roll`}
      aria-pressed={focused}
      draggable={false}
      {...handlers}
    >
      <motion.span
        className="canister-visual"
        initial={reducedMotion ? false : { y: -90, opacity: 0 }}
        animate={{ y: interaction === "hover" ? -9 : interaction === "dragging" ? -11 : 0, opacity: 1 }}
        transition={{ duration: interaction === "hover" ? 0.22 : 0.28, ease: "easeOut" }}
      >
        <span className="canister-top" aria-hidden="true" />
        <span className="canister-wrapper">
          <span className="canister-brand">UNX / COLOR NEGATIVE</span>
          <strong>{roll.title}</strong>
          <span className="canister-speed">400</span>
          <span className="canister-theme">{roll.theme}</span>
        </span>
        <span className="canister-bottom" aria-hidden="true" />
        <span className="canister-shadow" aria-hidden="true" />
      </motion.span>
    </button>
  );
}
