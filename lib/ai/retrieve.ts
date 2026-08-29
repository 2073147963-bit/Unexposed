// RAG 检索：加载 data/index.json 进内存，embedding 用户 query，余弦相似度取 top-k。
// 仅在服务端（nodejs runtime）使用，依赖 node:fs。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMBED_MODEL, OLLAMA_HOST, RAG_TOP_K } from "./config";

interface IndexChunk {
  text: string;
}

interface IndexFile {
  model: string;
  chunks: IndexChunk[];
  vectors: number[][];
}

let cachedIndex: IndexFile | null = null;

function loadIndex(): IndexFile {
  if (cachedIndex) return cachedIndex;
  const raw = readFileSync(join(process.cwd(), "data", "index.json"), "utf8");
  cachedIndex = JSON.parse(raw) as IndexFile;
  return cachedIndex;
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // keep_alive: -1 让 embedding 模型常驻内存，消除每次请求的冷启动。
    body: JSON.stringify({ model: EMBED_MODEL, input: [text], keep_alive: -1 }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status}`);
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings[0];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieve(query: string, topK: number = RAG_TOP_K): Promise<IndexChunk[]> {
  const index = loadIndex();
  if (!index.vectors.length) return [];
  const queryVector = await embed(query);
  const scored = index.vectors.map((vector, i) => ({ i, score: cosine(queryVector, vector) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((entry) => index.chunks[entry.i]);
}
