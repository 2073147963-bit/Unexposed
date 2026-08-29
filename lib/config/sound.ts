export const soundNames = [
  "breathing",
  "wardAmbience",
  "monitor",
  "distantVoices",
  "deskRoomTone",
  "sealRoll",
  "openRoll",
] as const;

export type SoundName = (typeof soundNames)[number];

export const soundConfig = {
  masterVolume: 0.28,
  breathing: { volume: 0.032, cycleSeconds: 4.8 },
  wardAmbience: { volume: 0.018, filterHz: 520 },
  monitor: { volume: 0.016, intervalMs: 2650, frequency: 740 },
  distantVoices: { volume: 0.009, filterHz: 430 },
  deskRoomTone: { volume: 0.012, filterHz: 280 },
  sealRoll: { volume: 0.07, duration: 0.38 },
  openRoll: { volume: 0.045, duration: 0.72 },
} as const;
