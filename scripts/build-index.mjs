// 构建 RAG 检索索引：读取自定义语料文本，按对话行切分，调用 Ollama embedding，输出 data/index.json。
//
// 用法（在项目根目录运行）：
//   node scripts/build-index.mjs <语料文本路径>
//   例如：node scripts/build-index.mjs ./data/my-licensed-corpus.txt
//
// 语料文本格式（每行一条，支持续行）：SPEAKER -- 内容
//   说话人为大写字母开头，可含括号/方括号，如 "NARRATOR -- ..."、"PERCEPTION (SMELL) -- ..."。
//
// 前置：ollama serve 已运行，且已 `ollama pull bge-m3`。
// 版权说明：公开仓库不包含任何未确认授权的语料或派生向量。请只使用你自有或已获得明确
// 授权的文本材料；生成的 data/index.json 供本地使用，是否公开由你自行判断。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

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
  const corpusArg = process.argv[2];
  if (!corpusArg) {
    console.error(`
用法：node scripts/build-index.mjs <语料文本路径>

示例：
  node scripts/build-index.mjs ./data/my-licensed-corpus.txt

说明：
- 语料为 UTF-8 文本，每行一条：SPEAKER -- 内容（支持后续行自动并接）。
- 公开仓库不包含版权未确认的语料；请使用你自有或已获得明确授权的材料。
- 前置：ollama serve 已运行，且已 ollama pull ${EMBED_MODEL}。
`);
    process.exit(1);
  }

  const corpusPath = resolve(corpusArg);
  if (!existsSync(corpusPath)) {
    console.error(`找不到语料文件：${corpusPath}`);
    console.error("请确认路径正确；示例：node scripts/build-index.mjs ./data/my-licensed-corpus.txt");
    process.exit(1);
  }

  const text = readFileSync(corpusPath, "utf8");
  const units = parseUnits(text);
  if (units.length === 0) {
    console.error(
      "没有解析出任何对话单元。请检查语料格式：每行应为 \"SPEAKER -- 内容\"（说话人大写字母开头，" +
        "支持续行自动并接到上一条）。",
    );
    process.exit(1);
  }
  const chunks = mergeUnits(units);
  console.log(`切分出 ${units.length} 个对话单元，合并为 ${chunks.length} 个 chunk`);

  try {
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
  } catch (err) {
    console.error(`向量化失败：${err?.message ?? err}`);
    console.error(`请确认 Ollama 正在运行（${OLLAMA}）且已安装 ${EMBED_MODEL}。`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
