// 本地数据备份与恢复：全表序列化为单一 JSON 文件（照片与语音 Blob 内嵌 base64）。
// 序列化按「明确字段」处理日期（createdAt / sealedAt 等 → ISO 字符串），恢复时按字段
// 显式还原为 Date——不依赖通用 reviver，避免日期被静默转成字符串。
// 导入前做严格校验（格式 / 版本 / 结构 / 体积），任何校验失败都会在写入前抛出，不破坏现有数据。
import { deleteDatabase, getDatabase } from "@/lib/db";
import type { ConversationRecord, PhotoDescription, PhotoOpening, Reflection, RollVersion, StoredRoll } from "@/lib/types";

const FORMAT = "unexposed-backup";
const SUPPORTED_VERSION = 1;
// 备份文件体积上限：500MB（纯 JSON + base64，正常备份远小于此值）。
const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

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

// ===== 明确字段的照片编解码（日期一律 ISO 字符串） =====

interface PhotoBackup {
  id: string;
  rollId: string;
  createdAt: string; // ISO
  caption: string;
  position: number;
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
    createdAt: photo.createdAt.toISOString(),
    caption: photo.caption,
    position: photo.position,
    image: await toRef(photo.imageBlob),
    voiceNote: photo.voiceNoteBlob ? await toRef(photo.voiceNoteBlob) : undefined,
  };
}

function decodePhoto(photo: {
  id: string;
  rollId: string;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  image: BlobRef;
  voiceNote?: BlobRef;
}): {
  id: string;
  rollId: string;
  imageBlob: Blob;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  voiceNoteBlob?: Blob;
} {
  return {
    id: String(photo.id),
    rollId: String(photo.rollId),
    imageBlob: fromRef(photo.image),
    createdAt: new Date(photo.createdAt),
    caption: String(photo.caption ?? ""),
    position: photo.position === 2 || photo.position === 3 ? photo.position : 1,
    voiceNoteBlob: photo.voiceNote ? fromRef(photo.voiceNote) : undefined,
  };
}

type BackupRoll = Omit<StoredRoll, "photos" | "createdAt" | "sealedAt"> & {
  createdAt: string;
  sealedAt: string | null;
  photos: PhotoBackup[];
};

type BackupVersion = Omit<RollVersion, "photos" | "createdAt" | "sealedAt"> & {
  createdAt: string;
  sealedAt: string;
  photos: PhotoBackup[];
};

interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  rolls: BackupRoll[];
  versions: BackupVersion[];
  reflections: ReflectionBackup[];
  conversations: ConversationBackup[];
  descriptions: PhotoDescriptionBackup[];
  openings: PhotoOpeningBackup[];
}

interface ReflectionBackup {
  id: string;
  photoId: string;
  content: string;
  createdAt: string;
  type: string;
}

interface ConversationBackup {
  id: string;
  photoId: string;
  messages: { role: string; content: string }[];
  createdAt: string;
}

interface PhotoDescriptionBackup {
  photoId: string;
  description: string;
  createdAt: string;
}

interface PhotoOpeningBackup {
  photoId: string;
  opening: string;
  language: string;
  createdAt: string;
  version?: number;
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
  return {
    app: FORMAT,
    version: SUPPORTED_VERSION,
    exportedAt: new Date().toISOString(),
    rolls: await Promise.all(
      rolls.map(async (roll) => ({
        id: roll.id,
        title: roll.title,
        theme: roll.theme,
        createdAt: roll.createdAt.toISOString(),
        sealedAt: roll.sealedAt ? roll.sealedAt.toISOString() : null,
        coverPhotoId: roll.coverPhotoId,
        photos: await Promise.all(roll.photos.map(encodePhoto)),
        reflections: roll.reflections,
        sealed: roll.sealed,
        sealedVersionId: roll.sealedVersionId,
        status: roll.status,
        step: roll.step,
      })),
    ),
    versions: await Promise.all(
      versions.map(async (version) => ({
        id: version.id,
        rollId: version.rollId,
        version: version.version,
        kind: version.kind,
        title: version.title,
        theme: version.theme,
        createdAt: version.createdAt.toISOString(),
        sealedAt: version.sealedAt.toISOString(),
        photos: await Promise.all([...version.photos].map(encodePhoto)),
      })),
    ),
    reflections: reflections.map((item) => ({
      id: item.id,
      photoId: item.photoId,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      type: item.type,
    })),
    conversations: conversations.map((item) => ({
      id: item.id,
      photoId: item.photoId,
      messages: item.messages,
      createdAt: item.createdAt.toISOString(),
    })),
    descriptions: descriptions.map((item) => ({
      photoId: item.photoId,
      description: item.description,
      createdAt: item.createdAt.toISOString(),
    })),
    openings: openings.map((item) => ({
      photoId: item.photoId,
      opening: item.opening,
      language: item.language,
      createdAt: item.createdAt.toISOString(),
      version: item.version,
    })),
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `unexposed-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ===== 严格校验 =====

export class BackupValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new BackupValidationError(`字段 ${field} 缺失或类型错误。`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new BackupValidationError(`字段 ${field} 类型错误。`);
  return value;
}

function requireDate(value: unknown, field: string): Date {
  const raw = requireString(value, field);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new BackupValidationError(`字段 ${field} 不是有效日期。`);
  return date;
}

function requireBlobRef(value: unknown, field: string): BlobRef {
  const ref = value as BlobRef;
  if (!ref || typeof ref !== "object" || typeof ref.data !== "string" || ref.data.length === 0) {
    throw new BackupValidationError(`字段 ${field} 缺少照片或语音数据。`);
  }
  const mime = typeof ref.mime === "string" ? ref.mime : "application/octet-stream";
  return { mime, data: ref.data };
}

function decodePhotoFrom(backup: unknown): ReturnType<typeof decodePhoto> {
  const photo = backup as PhotoBackup;
  requireString(photo?.id, "photo.id");
  requireString(photo?.rollId, "photo.rollId");
  requireDate(photo?.createdAt, "photo.createdAt");
  const decoded = decodePhoto({
    id: photo.id,
    rollId: photo.rollId,
    createdAt: new Date(photo.createdAt),
    caption: typeof photo.caption === "string" ? photo.caption : "",
    position: photo.position === 2 || photo.position === 3 ? photo.position : 1,
    image: requireBlobRef(photo?.image, "photo.image"),
    voiceNote: photo?.voiceNote ? requireBlobRef(photo.voiceNote, "photo.voiceNote") : undefined,
  });
  return decoded;
}

function validatePhotoArray(raw: unknown, field: string): PhotoBackup[] {
  if (!Array.isArray(raw)) throw new BackupValidationError(`字段 ${field} 缺失或不是数组。`);
  return raw.map((item) => {
    const photo = item as PhotoBackup;
    requireString(photo?.id, `${field}.id`);
    requireDate(photo?.createdAt, `${field}.createdAt`);
    requireBlobRef(photo?.image, `${field}.image`);
    return photo;
  });
}

// 完整校验并解码备份：任何一步失败都会抛出 BackupValidationError（调用方在写入前调用，
// 因此校验失败不会影响数据库中的现有数据）。
function parseBackup(json: string): {
  rolls: StoredRoll[];
  versions: RollVersion[];
  reflections: Reflection[];
  conversations: ConversationRecord[];
  descriptions: PhotoDescription[];
  openings: PhotoOpening[];
  counts: RestoreResult;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupValidationError("备份文件不是有效的 JSON。");
  }
  const root = raw as Partial<BackupFile>;
  if (root?.app !== FORMAT) throw new BackupValidationError("这不是 Unexposed 的备份文件。");
  if (root?.version !== SUPPORTED_VERSION) {
    throw new BackupValidationError(`备份版本不支持（文件 v${String(root?.version)}，当前支持 v${SUPPORTED_VERSION}）。`);
  }
  requireString(root?.exportedAt, "exportedAt");

  const rolls: StoredRoll[] = (Array.isArray(root.rolls) ? root.rolls : []).map((roll) => {
    requireString(roll?.id, "roll.id");
    requireString(roll?.title, "roll.title");
    requireDate(roll?.createdAt, "roll.createdAt");
    const photos = validatePhotoArray(roll?.photos, "roll.photos").map(decodePhotoFrom);
    return {
      id: roll.id,
      title: roll.title,
      theme: typeof roll.theme === "string" ? roll.theme : "No theme",
      createdAt: requireDate(roll.createdAt, "roll.createdAt"),
      sealedAt: roll.sealedAt == null ? null : requireDate(roll.sealedAt, "roll.sealedAt"),
      coverPhotoId: typeof roll.coverPhotoId === "string" ? roll.coverPhotoId : null,
      photos,
      reflections: Array.isArray(roll.reflections) ? roll.reflections : [],
      sealed: Boolean(roll.sealed),
      sealedVersionId: typeof roll.sealedVersionId === "string" ? roll.sealedVersionId : null,
      status: roll.status === "sealed" ? "sealed" : "draft",
      step:
        roll.step === "details" || roll.step === "photos" || roll.step === "reflections" || roll.step === "preview"
          ? roll.step
          : "sealed",
    } satisfies StoredRoll;
  });

  const versions: RollVersion[] = (Array.isArray(root.versions) ? root.versions : []).map((version) => {
    requireString(version?.id, "version.id");
    requireString(version?.rollId, "version.rollId");
    requireDate(version?.createdAt, "version.createdAt");
    requireDate(version?.sealedAt, "version.sealedAt");
    const photos = validatePhotoArray(version?.photos, "version.photos").map(decodePhotoFrom);
    return {
      id: version.id,
      rollId: version.rollId,
      version: typeof version.version === "number" ? version.version : 1,
      kind: version.kind === "double-exposure" ? "double-exposure" : "sealed",
      title: typeof version.title === "string" ? version.title : "",
      theme: typeof version.theme === "string" ? version.theme : "No theme",
      createdAt: requireDate(version.createdAt, "version.createdAt"),
      sealedAt: requireDate(version.sealedAt, "version.sealedAt"),
      photos,
    } satisfies RollVersion;
  });

  const reflections: Reflection[] = (Array.isArray(root.reflections) ? root.reflections : []).map((item) => ({
    id: requireString(item?.id, "reflection.id"),
    photoId: requireString(item?.photoId, "reflection.photoId"),
    content: requireString(item?.content, "reflection.content"),
    createdAt: requireDate(item?.createdAt, "reflection.createdAt"),
    type: item.type === "double-exposure" ? "double-exposure" : "original",
  }));

  const conversations: ConversationRecord[] = (Array.isArray(root.conversations) ? root.conversations : []).map(
    (item) => ({
      id: requireString(item?.id, "conversation.id"),
      photoId: requireString(item?.photoId, "conversation.photoId"),
      messages: Array.isArray(item?.messages)
        ? (item.messages as { role: string; content: string }[])
            .filter((message) => typeof message.content === "string")
            .map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: message.content }))
        : [],
      createdAt: requireDate(item?.createdAt, "conversation.createdAt"),
    }),
  );

  const descriptions: PhotoDescription[] = (Array.isArray(root.descriptions) ? root.descriptions : []).map((item) => ({
    photoId: requireString(item?.photoId, "description.photoId"),
    description: typeof item?.description === "string" ? item.description : "",
    createdAt: requireDate(item?.createdAt, "description.createdAt"),
  }));

  const openings: PhotoOpening[] = (Array.isArray(root.openings) ? root.openings : []).map((item) => ({
    photoId: requireString(item?.photoId, "opening.photoId"),
    opening: typeof item?.opening === "string" ? item.opening : "",
    language: item?.language === "en" ? "en" : "zh",
    createdAt: requireDate(item?.createdAt, "opening.createdAt"),
    version: typeof item?.version === "number" ? item.version : 1,
  }));

  return {
    rolls,
    versions,
    reflections,
    conversations,
    descriptions,
    openings,
    counts: {
      rolls: rolls.length,
      versions: versions.length,
      reflections: reflections.length,
      conversations: conversations.length,
      descriptions: descriptions.length,
      openings: openings.length,
    },
  };
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
  if (file.size > MAX_BACKUP_BYTES) {
    throw new BackupValidationError("备份文件体积异常过大，已拒绝导入。");
  }
  const json = await file.text();
  // 先完整校验并解码（全部在内存中完成），再进入写入事务——校验失败不会碰数据库。
  const { rolls, versions, reflections, conversations, descriptions, openings, counts } = parseBackup(json);

  const db = getDatabase();
  await db.transaction(
    "rw",
    [db.rolls, db.rollVersions, db.reflections, db.conversations, db.photoDescriptions, db.photoOpenings],
    async () => {
      if (rolls.length) await db.rolls.bulkPut(rolls);
      if (versions.length) await db.rollVersions.bulkPut(versions);
      if (reflections.length) await db.reflections.bulkPut(reflections);
      if (conversations.length) await db.conversations.bulkPut(conversations);
      if (descriptions.length) await db.photoDescriptions.bulkPut(descriptions);
      if (openings.length) await db.photoOpenings.bulkPut(openings);
    },
  );
  return counts;
}

// 完整清空：删除整个 IndexedDB 数据库。调用方应自行确认并在完成后刷新页面。
export async function wipeAllData(): Promise<void> {
  await deleteDatabase();
}
