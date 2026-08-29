import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { BackupValidationError, buildBackup, restoreFromBackup, wipeAllData } from "@/lib/db/backup";
import { getRoll, getDatabase } from "@/lib/db";

// 用一张 1x1 红色像素 JPEG 造一张测试照片（内容不重要，走完整的 Blob 编解码链路）。
const RED_PIXEL_JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
    "base64",
  ),
);

function makeImageBlob(): Blob {
  return new Blob([RED_PIXEL_JPEG], { type: "image/jpeg" });
}

function makeBackupFile(json: string): File {
  return new File([json], "backup.json", { type: "application/json" });
}

const CREATED_AT = new Date("2026-08-01T08:00:00.000Z");
const SEALED_AT = new Date("2026-08-29T12:30:00.000Z");

// 创建一卷已封存、含三张照片的胶卷（走真实的 saveRoll + sealRollRecord 链路）。
async function seedSealedRoll(rollId: string, title: string) {
  const db = getDatabase();
  const photo = (n: 1 | 2 | 3) => ({
    id: `${rollId}-p${n}`,
    rollId,
    imageBlob: makeImageBlob(),
    createdAt: CREATED_AT,
    caption: `照片 ${n} 的说明`,
    position: n,
  });
  const roll = {
    id: rollId,
    title,
    theme: "No theme",
    createdAt: CREATED_AT,
    sealedAt: null,
    coverPhotoId: null,
    photos: [photo(1), photo(2), photo(3)],
    reflections: [],
    sealed: false,
    sealedVersionId: null,
    status: "draft" as const,
    step: "preview" as const,
  };
  await db.rolls.put(roll);
  return { roll, sealedRoll: await (await import("@/lib/db")).sealRollRecord(roll) };
}

describe("备份与恢复", () => {
  beforeEach(async () => {
    await wipeAllData();
  });

  it("创建 → 导出 → 清空 → 导入 → 重新打开胶卷：日期、Blob 与字段完整还原", async () => {
    const { sealedRoll } = await seedSealedRoll("roll-1", "支教2022");

    // 导出并序列化为备份文件内容
    const backup = await buildBackup();
    const json = JSON.stringify(backup);

    // 清空全部数据
    await wipeAllData();
    expect(await getRoll("roll-1")).toBeUndefined();

    // 导入恢复
    const counts = await restoreFromBackup(makeBackupFile(json));
    expect(counts.rolls).toBe(1);
    expect(counts.versions).toBe(1);

    // 重新打开胶卷：日期是 Date 对象、可调用 getFullYear，字段与封存时间一致
    const restored = await getRoll("roll-1");
    expect(restored).toBeDefined();
    expect(restored?.title).toBe("支教2022");
    expect(restored?.createdAt).toBeInstanceOf(Date);
    expect(restored?.createdAt.getFullYear()).toBe(2026);
    expect(restored?.sealedAt).toBeInstanceOf(Date);
    expect(restored?.sealedAt?.getTime()).toBe(sealedRoll.sealedAt?.getTime());
    expect(restored?.photos).toHaveLength(3);
    expect(restored?.photos[0].imageBlob).toBeInstanceOf(Blob);
    expect(restored?.photos[0].imageBlob.size).toBe(makeImageBlob().size);

    // 排序字段与版本快照完整
    expect(restored?.photos.map((p) => p.position)).toEqual([1, 2, 3]);
    const versions = await getDatabase().rollVersions.where("rollId").equals("roll-1").toArray();
    expect(versions).toHaveLength(1);
    expect(versions[0].createdAt).toBeInstanceOf(Date);
    expect(versions[0].photos).toHaveLength(3);
    expect(sealedRoll.sealedVersionId).toBe(restored?.sealedVersionId);
  });

  it("拒绝非 Unexposed 备份与不支持的版本，且不破坏现有数据", async () => {
    await seedSealedRoll("roll-keep", "保留卷");

    // app 字段不对
    const wrongApp = JSON.stringify({ app: "other-app", version: 1, rolls: [] });
    await expect(restoreFromBackup(makeBackupFile(wrongApp))).rejects.toBeInstanceOf(BackupValidationError);

    // 版本不支持
    const wrongVersion = JSON.stringify({ app: "unexposed-backup", version: 99, rolls: [] });
    await expect(restoreFromBackup(makeBackupFile(wrongVersion))).rejects.toBeInstanceOf(BackupValidationError);

    // 截断的 JSON
    await expect(restoreFromBackup(makeBackupFile("{not-json"))).rejects.toBeInstanceOf(BackupValidationError);

    // 失败的导入不影响现有数据
    const kept = await getRoll("roll-keep");
    expect(kept?.title).toBe("保留卷");
    expect(kept?.photos).toHaveLength(3);
  });

  it("导出的 JSON 只含明确字段：日期为 ISO 字符串、照片为 BlobRef", async () => {
    await seedSealedRoll("roll-json", "字段检查");
    const backup = await buildBackup();
    const json = JSON.stringify(backup);
    const parsed = JSON.parse(json);

    expect(parsed.app).toBe("unexposed-backup");
    expect(typeof parsed.exportedAt).toBe("string");
    expect(typeof parsed.rolls[0].createdAt).toBe("string");
    expect(typeof parsed.rolls[0].sealedAt).toBe("string");
    expect(parsed.rolls[0].photos[0].image.mime).toBe("image/jpeg");
    expect(typeof parsed.rolls[0].photos[0].image.data).toBe("string");
    // Blob 不能直接出现在 JSON 里
    expect(json).not.toContain('"imageBlob"');
  });
});
