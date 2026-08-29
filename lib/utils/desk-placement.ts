export interface DeskPlacement {
  x: number;
  y: number;
  rotation: number;
  layer: number;
}

const anchors = [
  [14, 19],
  [43, 13],
  [74, 21],
  [27, 42],
  [58, 39],
  [83, 48],
  [12, 67],
  [39, 72],
  [68, 69],
  [88, 82],
] as const;

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDeskPlacements(ids: string[]) {
  const placements = new Map<string, DeskPlacement>();
  const occupied = new Set<number>();
  const sortedIds = [...ids].sort((a, b) => stableHash(a) - stableHash(b));

  sortedIds.forEach((id, index) => {
    const hash = stableHash(id);
    const layer = Math.floor(index / anchors.length);
    let slot = hash % anchors.length;

    while (occupied.has(slot) && occupied.size < anchors.length) {
      slot = (slot + 1) % anchors.length;
    }
    if (layer === 0) occupied.add(slot);

    const [baseX, baseY] = anchors[slot];
    const xJitter = ((hash >>> 8) % 41) / 10 - 2;
    const yJitter = ((hash >>> 16) % 31) / 10 - 1.5;
    const rawRotation = ((hash >>> 24) % 17) - 8;

    placements.set(id, {
      x: Math.min(88, Math.max(10, baseX + xJitter + layer * 1.5)),
      y: Math.min(80, Math.max(12, baseY + yJitter + layer * 1.5)),
      rotation: rawRotation === 0 ? 2 : rawRotation,
      layer,
    });
  });

  return placements;
}
