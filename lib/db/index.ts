import Dexie, { type EntityTable } from "dexie";

import type { ConversationRecord, PhotoDescription, PhotoOpening, Reflection, RollVersion, StoredRoll } from "@/lib/types";

class UnexposedDatabase extends Dexie {
  rolls!: EntityTable<StoredRoll, "id">;
  rollVersions!: EntityTable<RollVersion, "id">;
  reflections!: EntityTable<Reflection, "id">;
  conversations!: EntityTable<ConversationRecord, "id">;
  photoDescriptions!: EntityTable<PhotoDescription, "photoId">;
  photoOpenings!: EntityTable<PhotoOpening, "photoId">;

  constructor() {
    super("unexposed");
    this.version(1).stores({
      rolls: "id, status, createdAt, sealedAt",
    });
    this.version(2)
      .stores({
        rolls: "id, status, createdAt, sealedAt",
        rollVersions: "id, rollId, [rollId+version], kind, createdAt",
      })
      .upgrade(async (transaction) => {
        const rolls = transaction.table<StoredRoll, string>("rolls");
        const versions = transaction.table<RollVersion, string>("rollVersions");

        await rolls.toCollection().modify((roll) => {
          roll.sealed = roll.status === "sealed";
          roll.sealedVersionId ??= null;
        });

        const previouslySealed = await rolls.where("status").equals("sealed").toArray();
        for (const roll of previouslySealed) {
          if (!roll.sealedAt || roll.sealedVersionId) continue;
          const version = createSealedVersion(roll, roll.sealedAt);
          roll.sealedVersionId = version.id;
          await versions.put(version);
          await rolls.put(roll);
        }
      });
    this.version(3)
      .stores({
        rolls: "id, status, createdAt, sealedAt",
        rollVersions: "id, rollId, [rollId+version], kind, createdAt",
        reflections: "id, photoId, [photoId+createdAt], createdAt, type",
      })
      .upgrade(async (transaction) => {
        const rolls = transaction.table<StoredRoll, string>("rolls");
        const reflections = transaction.table<Reflection, string>("reflections");
        const storedRolls = await rolls.toArray();
        for (const roll of storedRolls) {
          for (const reflection of roll.reflections ?? []) await reflections.put(reflection);
        }
      });
    this.version(4).stores({
      rolls: "id, status, createdAt, sealedAt",
      rollVersions: "id, rollId, [rollId+version], kind, createdAt",
      reflections: "id, photoId, [photoId+createdAt], createdAt, type",
      conversations: "id, photoId, createdAt",
    });
    this.version(5).stores({
      rolls: "id, status, createdAt, sealedAt",
      rollVersions: "id, rollId, [rollId+version], kind, createdAt",
      reflections: "id, photoId, [photoId+createdAt], createdAt, type",
      conversations: "id, photoId, createdAt",
      photoDescriptions: "photoId, createdAt",
    });
    this.version(6).stores({
      rolls: "id, status, createdAt, sealedAt",
      rollVersions: "id, rollId, [rollId+version], kind, createdAt",
      reflections: "id, photoId, [photoId+createdAt], createdAt, type",
      conversations: "id, photoId, createdAt",
      photoDescriptions: "photoId, createdAt",
      photoOpenings: "photoId, createdAt",
    });
  }
}

let database: UnexposedDatabase | undefined;

export function getDatabase() {
  if (typeof window === "undefined") {
    throw new Error("The local database is only available in the browser.");
  }

  database ??= new UnexposedDatabase();
  return database;
}

export async function getActiveDraft() {
  return getDatabase()
    .rolls.where("status")
    .equals("draft")
    .reverse()
    .sortBy("createdAt")
    .then((rolls) => rolls[0]);
}

export async function getSealedRolls() {
  return getDatabase()
    .rolls.where("status")
    .equals("sealed")
    .reverse()
    .sortBy("sealedAt");
}

export async function getRoll(id: string) {
  return getDatabase().rolls.get(id);
}

export async function getRollVersion(id: string | null) {
  return id ? getDatabase().rollVersions.get(id) : undefined;
}

export async function saveRoll(roll: StoredRoll) {
  await getDatabase().rolls.put(roll);
}

export async function getPhotoReflections(photoId: string) {
  return getDatabase().reflections.where("photoId").equals(photoId).sortBy("createdAt");
}

export async function addDoubleExposure(photoId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("A reflection cannot be empty.");
  const reflection: Reflection = {
    id: crypto.randomUUID(),
    photoId,
    content: trimmed,
    createdAt: new Date(),
    type: "double-exposure",
  };
  await getDatabase().reflections.add(reflection);
  return reflection;
}

export async function saveConversation(record: ConversationRecord) {
  await getDatabase().conversations.add(record);
}

export async function getPhotoConversations(photoId: string) {
  return getDatabase().conversations.where("photoId").equals(photoId).sortBy("createdAt");
}

export async function getPhotoDescription(photoId: string) {
  return getDatabase().photoDescriptions.get(photoId);
}

export async function savePhotoDescription(description: PhotoDescription) {
  await getDatabase().photoDescriptions.put(description);
}

export async function getPhotoOpening(photoId: string) {
  return getDatabase().photoOpenings.get(photoId);
}

export async function savePhotoOpening(opening: PhotoOpening) {
  await getDatabase().photoOpenings.put(opening);
}

// 把提炼出来的关键信息追加到照片说明（caption）末尾；封存的版本和活卷都要同步更新。
function appendCaption(existing: string, addition: string): string {
  const trimmed = addition.trim();
  if (!trimmed) return existing;
  return existing.trim() ? `${existing.trim()} ${trimmed}` : trimmed;
}

export async function appendPhotoCaption(rollId: string, photoId: string, addition: string) {
  const trimmed = addition.trim();
  if (!trimmed) return;
  const database = getDatabase();
  const roll = await database.rolls.get(rollId);
  if (!roll) return;

  if (roll.sealedVersionId) {
    const version = await database.rollVersions.get(roll.sealedVersionId);
    if (version) {
      const photos = version.photos.map((photo) =>
        photo.id === photoId ? { ...photo, caption: appendCaption(photo.caption, trimmed) } : photo,
      );
      await database.rollVersions.put({ ...version, photos });
    }
  }

  const livePhotos = roll.photos.map((photo) =>
    photo.id === photoId ? { ...photo, caption: appendCaption(photo.caption, trimmed) } : photo,
  );
  await database.rolls.put({ ...roll, photos: livePhotos });
}

function createSealedVersion(roll: StoredRoll, sealedAt: Date): RollVersion {
  return {
    id: crypto.randomUUID(),
    rollId: roll.id,
    version: 1,
    kind: "sealed",
    title: roll.title,
    theme: roll.theme,
    createdAt: roll.createdAt,
    sealedAt,
    photos: roll.photos.map((photo) => ({
      id: photo.id,
      rollId: photo.rollId,
      imageBlob: photo.imageBlob,
      createdAt: photo.createdAt,
      caption: photo.caption,
      position: photo.position,
      voiceNoteBlob: photo.voiceNoteBlob,
    })),
  };
}

export async function sealRollRecord(roll: StoredRoll) {
  if (roll.photos.length !== 3) {
    throw new Error("A roll must contain exactly three photos before sealing.");
  }
  if (roll.sealed) {
    throw new Error("This roll is already sealed.");
  }

  const database = getDatabase();
  const sealedAt = new Date();
  const version = createSealedVersion(roll, sealedAt);
  const sealedRoll: StoredRoll = {
    ...roll,
    sealed: true,
    sealedAt,
    sealedVersionId: version.id,
    coverPhotoId: roll.photos[0].id,
    status: "sealed",
    step: "sealed",
  };

  await database.transaction("rw", database.rolls, database.rollVersions, async () => {
    await database.rollVersions.add(version);
    await database.rolls.put(sealedRoll);
  });

  return sealedRoll;
}
