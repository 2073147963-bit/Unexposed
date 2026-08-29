// 本地推理引擎配置。可通过环境变量覆盖，便于后续换模型 / 换部署形态。
export const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
export const GENERATION_MODEL = process.env.GENERATION_MODEL || "qwen2.5:7b";
export const VISION_MODEL = process.env.VISION_MODEL || "qwen2.5vl:7b";
export const EMBED_MODEL = process.env.EMBED_MODEL || "bge-m3";
export const RAG_TOP_K = Number(process.env.RAG_TOP_K || 3);
