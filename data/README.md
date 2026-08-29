# Optional retrieval data

The public submission intentionally contains an empty retrieval index.

The prototype's original research corpus and generated vectors are not included because their redistribution rights have not been confirmed. The application automatically continues without retrieval when this index is empty. Teams may replace `index.json` with an index built from self-authored or clearly licensed material.

## 构建自有语料的索引 / Build an index from your own corpus

```bash
node scripts/build-index.mjs ./data/my-licensed-corpus.txt
```

- 语料为 UTF-8 文本，每行一条：`SPEAKER -- 内容`（支持后续行自动并接）。
- 前置：本机 Ollama 已运行且已安装 `bge-m3`。
- 公开仓库不含版权未确认的语料与派生向量；请只使用自有或授权明确的材料。

The public repo ships an empty index only. Build your own index from self-authored or clearly licensed text with the command above (requires a running local Ollama with `bge-m3`).
