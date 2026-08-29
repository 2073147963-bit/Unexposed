// 构建 RAG 索引：读取 data/disco-en.txt，按对话轮切分，调用 Ollama embedding，输出 data/index.json。
// 用法（在项目根目录运行）：node scripts/build-index.mjs
// 前置：ollama serve 已运行，且已 pull bge-m3。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";
const EMBED_MODEL = process.env.EMBED_MODEL || "bge-m3";

// 对话行格式：SPEAKER -- content（speaker 为大写字母开头，可含括号/方括号，如
// "INLAND EMPIRE [Medium: Success] -- ..."、"PERCEPTION (SMELL) -- ..."）。
const speakerRe = /^([A-Z][A-Z0-9 ()\[\]\.\/'\-]{1,60}) -- (.*)$/;

function parseUnits(text) {
  const units = [];
  let current = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(speakerRe);
    if (match) {
      current = { speaker: match[1].trim(), text: match[2].trim() };
      units.push(current);
    } else if (current) {
      current.text += " " + line;
    }
  }
  return units;
}

function mergeUnits(units, maxLen = 700) {
  const chunks = [];
  let buffer = "";
  for (const unit of units) {
    const line = `${unit.speaker} -- ${unit.text}`;
    if (buffer && buffer.length + line.length + 1 > maxLen) {
      chunks.push({ text: buffer });
      buffer = line;
    } else {
      buffer = buffer ? `${buffer}\n${line}` : line;
    }
  }
  if (buffer) chunks.push({ text: buffer });
  return chunks;
}

async function embedBatch(inputs) {
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`embed 失败 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.embeddings;
}

async function main() {
  const text = readFileSync(join(ROOT, "data", "disco-en.txt"), "utf8");
  const units = parseUnits(text);
  const chunks = mergeUnits(units);
  console.log(`切分出 ${units.length} 个对话单元，合并为 ${chunks.length} 个 chunk`);

  const BATCH = 32;
  const vectors = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map((c) => c.text);
    const embeddings = await embedBatch(batch);
    vectors.push(...embeddings);
    console.log(`已向量化 ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }

  const index = { model: EMBED_MODEL, chunks, vectors };
  writeFileSync(join(ROOT, "data", "index.json"), JSON.stringify(index));
  console.log(`已写入 data/index.json（${chunks.length} 个向量）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
