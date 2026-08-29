export type ReflectionType = "original" | "double-exposure";

export interface Reflection {
  id: string;
  photoId: string;
  content: string;
  createdAt: Date;
  type: ReflectionType;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationRecord {
  id: string;
  photoId: string;
  messages: ConversationMessage[];
  createdAt: Date;
}

// 视觉模型对照片的客观描述，按 photoId 缓存，作为闪回对话的「事实底座」。
export interface PhotoDescription {
  photoId: string;
  description: string;
  createdAt: Date;
}

// 开场独白：视觉描述就绪后预生成并缓存，闪回打开即读缓存秒开。
export interface PhotoOpening {
  photoId: string;
  opening: string;
  language: "zh" | "en";
  createdAt: Date;
  version?: number; // 开场提示词版本：改动后旧缓存自动失效重新生成。
}

export interface PhotoMemory {
  id: string;
  rollId: string;
  imageBlob: Blob;
  createdAt: Date;
  caption: string;
  position: 1 | 2 | 3;
  voiceNoteBlob?: Blob;
}

export interface Roll {
  id: string;
  title: string;
  theme: string;
  createdAt: Date;
  sealedAt: Date | null;
  coverPhotoId: string | null;
  photos: PhotoMemory[];
  reflections: Reflection[];
}

export type RollStep = "details" | "photos" | "reflections" | "preview" | "sealed";

export interface HistoricalPhotoMemory {
  readonly id: string;
  readonly rollId: string;
  readonly imageBlob: Blob;
  readonly createdAt: Date;
  readonly caption: string;
  readonly position: 1 | 2 | 3;
  readonly voiceNoteBlob?: Blob;
}

export interface RollVersion {
  readonly id: string;
  readonly rollId: string;
  readonly version: number;
  readonly kind: "sealed" | "double-exposure";
  readonly title: string;
  readonly theme: string;
  readonly createdAt: Date;
  readonly sealedAt: Date;
  readonly photos: readonly HistoricalPhotoMemory[];
}

export interface StoredRoll extends Roll {
  sealed: boolean;
  sealedVersionId: string | null;
  status: "draft" | "sealed";
  step: RollStep;
}
