// 本地数据备份与恢复：全表序列化为单一 JSON 文件（照片与语音 Blob 内嵌 base64）。
// 恢复采用按 ID 合并（put），不删除未包含在备份中的记录；wipeAllData 提供完整清空。
import { getDatabase } from "@/lib/db";
import type { ConversationRecord, PhotoDescription, PhotoOpening, Reflection, RollVersion, StoredRoll } from "@/lib/types";

const FORMAT = "unexposed-backup";
const VERSION = 1;

interface BlobRef {
  mime: string;
  data: string;
}

async function toRef(blob: Blob): Promise<BlobRef> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return { mime: blob.type || "application/octet-stream", data: btoa(binary) };
}

function fromRef(ref: BlobRef): Blob {
  const binary = atob(ref.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: ref.mime || "application/octet-stream" });
}

interface PhotoBackup {
  id: string;
  rollId: string;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  image: BlobRef;
  voiceNote?: BlobRef;
}

async function encodePhoto(photo: {
  id: string;
  rollId: string;
  imageBlob: Blob;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  voiceNoteBlob?: Blob;
}): Promise<PhotoBackup> {
  return {
    id: photo.id,
    rollId: photo.rollId,
    createdAt: photo.createdAt,
    caption: photo.caption,
    position: photo.position,
    image: await toRef(photo.imageBlob),
    voiceNote: photo.voiceNoteBlob ? await toRef(photo.voiceNoteBlob) : undefined,
  };
}

function decodePhoto(photo: PhotoBackup): {
  id: string;
  rollId: string;
  imageBlob: Blob;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  voiceNoteBlob?: Blob;
} {
  return {
    id: photo.id,
    rollId: photo.rollId,
    imageBlob: fromRef(photo.image),
    createdAt: photo.createdAt,
    caption: photo.caption,
    position: photo.position,
    voiceNoteBlob: photo.voiceNote ? fromRef(photo.voiceNote) : undefined,
  };
}

type BackupRoll = Omit<StoredRoll, "photos"> & { photos: PhotoBackup[] };
type BackupVersion = Omit<RollVersion, "photos"> & { photos: PhotoBackup[] };

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  rolls: BackupRoll[];
  versions: BackupVersion[];
  reflections: Reflection[];
  conversations: ConversationRecord[];
  descriptions: PhotoDescription[];
  openings: PhotoOpening[];
}

// Date 序列化：{$date: iso}，解析时还原，保证 Dexie 存回的仍是 Date。
const replacer = (_key: string, value: unknown) => (value instanceof Date ? { $date: value.toISOString() } : value);

function reviveDates<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (_key, v) => {
    if (v && typeof v === "object" && "$date" in (v as Record<string, unknown>)) {
      return new Date((v as { $date: string }).$date);
    }
    return v;
  }) as T;
}

export async function buildBackup(): Promise<BackupFile> {
  const db = getDatabase();
  const [rolls, versions, reflections, conversations, descriptions, openings] = await Promise.all([
    db.rolls.toArray(),
    db.rollVersions.toArray(),
    db.reflections.toArray(),
    db.conversations.toArray(),
    db.photoDescriptions.toArray(),
    db.photoOpenings.toArray(),
  ]);
  return reviveDates<BackupFile>({
    app: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    rolls: await Promise.all(rolls.map(async (roll) => ({ ...roll, photos: await Promise.all(roll.photos.map(encodePhoto)) }))),
    versions: await Promise.all(
      versions.map(async (version) => ({ ...version, photos: await Promise.all([...version.photos].map(encodePhoto)) })),
    ),
    reflections,
    conversations,
    descriptions,
    openings,
  });
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, replacer);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `unexposed-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface RestoreResult {
  rolls: number;
  versions: number;
  reflections: number;
  conversations: number;
  descriptions: number;
  openings: number;
}

export async function restoreFromBackup(file: File): Promise<RestoreResult> {
  const parsed = reviveDates(JSON.parse(await file.text())) as BackupFile;
  if (parsed?.app !== FORMAT) throw new Error("不是有效的 Unexposed 备份文件。");

  const rolls = parsed.rolls?.map(decodePhotoRoll) ?? [];
  const versions = parsed.versions?.map(decodePhotoVersion) ?? [];
  const db = getDatabase();

  await db.transaction(
    "rw",
    [db.rolls, db.rollVersions, db.reflections, db.conversations, db.photoDescriptions, db.photoOpenings],
    async () => {
      if (rolls.length) await db.rolls.bulkPut(rolls);
      if (versions.length) await db.rollVersions.bulkPut(versions);
      if (parsed.reflections?.length) await db.reflections.bulkPut(parsed.reflections);
      if (parsed.conversations?.length) await db.conversations.bulkPut(parsed.conversations);
      if (parsed.descriptions?.length) await db.photoDescriptions.bulkPut(parsed.descriptions);
      if (parsed.openings?.length) await db.photoOpenings.bulkPut(parsed.openings);
    },
  );

  return {
    rolls: rolls.length,
    versions: versions.length,
    reflections: parsed.reflections?.length ?? 0,
    conversations: parsed.conversations?.length ?? 0,
    descriptions: parsed.descriptions?.length ?? 0,
    openings: parsed.openings?.length ?? 0,
  };
}

function decodePhotoRoll(backup: BackupRoll): StoredRoll {
  const { photos, ...rest } = backup;
  return { ...rest, photos: photos.map(decodePhoto) };
}

function decodePhotoVersion(backup: BackupVersion): RollVersion {
  const { photos, ...rest } = backup;
  return { ...rest, photos: photos.map(decodePhoto) };
}

// 完整清空：删除整个 IndexedDB 数据库。调用方应自行确认并在完成后刷新页面。
export async function wipeAllData(): Promise<void> {
  await getDatabase().delete();
}
