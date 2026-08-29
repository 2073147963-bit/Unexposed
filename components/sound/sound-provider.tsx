"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { soundConfig, type SoundName } from "@/lib/config/sound";

interface ActiveSound { nodes: AudioNode[]; stop: () => void }
interface SoundContextValue {
  audioReady: boolean;
  muted: boolean;
  playSound: (name: SoundName) => void;
  stopSound: (name: SoundName) => void;
  setMuted: (muted: boolean) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

function makeNoise(context: AudioContext, seconds = 3) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let value = 0;
  for (let index = 0; index < data.length; index += 1) {
    value = value * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[index] = value;
  }
  return buffer;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const activeRef = useRef(new Map<SoundName, ActiveSound>());
  const [audioReady, setAudioReady] = useState(false);
  const [muted, setMutedState] = useState(false);

  useEffect(() => { setMutedState(window.localStorage.getItem("unexposed-muted") === "true"); }, []);

  const unlock = useCallback(async () => {
    try {
      if (!contextRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const master = context.createGain();
        master.gain.value = muted ? 0 : soundConfig.masterVolume;
        master.connect(context.destination);
        contextRef.current = context;
        masterRef.current = master;
      }
      if (contextRef.current.state === "suspended") await contextRef.current.resume();
      setAudioReady(contextRef.current.state === "running");
    } catch { /* Audio is atmosphere only; failure is intentionally silent. */ }
  }, [muted]);

  useEffect(() => {
    const activate = () => { void unlock(); };
    window.addEventListener("pointerdown", activate, { once: true, capture: true });
    window.addEventListener("keydown", activate, { once: true, capture: true });
    return () => { window.removeEventListener("pointerdown", activate, true); window.removeEventListener("keydown", activate, true); };
  }, [unlock]);

  const stopSound = useCallback((name: SoundName) => {
    try { activeRef.current.get(name)?.stop(); } catch { /* no-op */ }
    activeRef.current.delete(name);
  }, []);

  const playSound = useCallback((name: SoundName) => {
    const context = contextRef.current;
    const master = masterRef.current;
    if (!context || !master || context.state !== "running" || activeRef.current.has(name)) return;
    try {
      const nodes: AudioNode[] = [];
      const gain = context.createGain();
      gain.connect(master);
      nodes.push(gain);
      let cleanup = () => { gain.disconnect(); };

      if (name === "monitor") {
        gain.gain.value = 1;
        const beep = () => {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.frequency.value = soundConfig.monitor.frequency;
          oscillator.type = "sine";
          envelope.gain.setValueAtTime(0, context.currentTime);
          envelope.gain.linearRampToValueAtTime(soundConfig.monitor.volume, context.currentTime + 0.018);
          envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
          oscillator.connect(envelope).connect(gain);
          oscillator.start(); oscillator.stop(context.currentTime + 0.12);
        };
        beep();
        const timer = window.setInterval(beep, soundConfig.monitor.intervalMs);
        cleanup = () => { window.clearInterval(timer); gain.disconnect(); };
      } else if (name === "breathing") {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const lfo = context.createOscillator();
        const depth = context.createGain();
        source.buffer = makeNoise(context, 4); source.loop = true;
        filter.type = "lowpass"; filter.frequency.value = 620;
        gain.gain.value = soundConfig.breathing.volume;
        lfo.frequency.value = 1 / soundConfig.breathing.cycleSeconds;
        depth.gain.value = soundConfig.breathing.volume * 0.72;
        lfo.connect(depth).connect(gain.gain); source.connect(filter).connect(gain);
        source.start(); lfo.start(); nodes.push(source, filter, lfo, depth);
        cleanup = () => { source.stop(); lfo.stop(); nodes.forEach((node) => { try { node.disconnect(); } catch {} }); };
      } else if (["wardAmbience", "distantVoices", "deskRoomTone"].includes(name)) {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        source.buffer = makeNoise(context, 5); source.loop = true;
        const settings = soundConfig[name as "wardAmbience" | "distantVoices" | "deskRoomTone"];
        filter.type = name === "distantVoices" ? "bandpass" : "lowpass";
        filter.frequency.value = settings.filterHz;
        filter.Q.value = name === "distantVoices" ? 0.7 : 0.2;
        gain.gain.value = settings.volume;
        source.connect(filter).connect(gain); source.start(); nodes.push(source, filter);
        cleanup = () => { source.stop(); nodes.forEach((node) => { try { node.disconnect(); } catch {} }); };
      } else {
        const settings = name === "sealRoll" ? soundConfig.sealRoll : soundConfig.openRoll;
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        source.buffer = makeNoise(context, settings.duration);
        filter.type = "bandpass"; filter.frequency.value = name === "sealRoll" ? 1250 : 720; filter.Q.value = 0.8;
        gain.gain.setValueAtTime(settings.volume, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + settings.duration);
        source.connect(filter).connect(gain); source.start(); source.stop(context.currentTime + settings.duration);
        nodes.push(source, filter);
        const timer = window.setTimeout(() => stopSound(name), settings.duration * 1000 + 80);
        cleanup = () => { window.clearTimeout(timer); try { source.stop(); } catch {} nodes.forEach((node) => { try { node.disconnect(); } catch {} }); };
      }
      activeRef.current.set(name, { nodes, stop: cleanup });
    } catch { stopSound(name); }
  }, [stopSound]);

  const setMuted = useCallback((nextMuted: boolean) => {
    setMutedState(nextMuted);
    window.localStorage.setItem("unexposed-muted", String(nextMuted));
    const context = contextRef.current;
    const master = masterRef.current;
    if (context && master) master.gain.setTargetAtTime(nextMuted ? 0 : soundConfig.masterVolume, context.currentTime, 0.04);
  }, []);

  useEffect(() => () => {
    activeRef.current.forEach((sound) => { try { sound.stop(); } catch {} });
    void contextRef.current?.close().catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ audioReady, muted, playSound, stopSound, setMuted }), [audioReady, muted, playSound, setMuted, stopSound]);
  return (
    <SoundContext.Provider value={value}>
      {children}
      <button className="global-sound-toggle" type="button" aria-pressed={muted} onClick={() => setMuted(!muted)}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error("useSound must be used within SoundProvider");
  return context;
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext } }
