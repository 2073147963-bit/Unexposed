# 素材与致谢 Credits

## 概念与文本

- 「三重脑」（爬虫脑 / 哺乳脑 / 新皮层）名称引用自 MacLean 的三重脑理论（*The Triune Brain in Evolution*, 1990），仅为概念借用；本项目中各声音的全部台词、立场与「思维阁」设定均为本产品原创。
- `lib/ai/style.ts` 中的人格提示词、`deliverables/` 内的演示脚本与口播均为原创文本。

## 开源依赖

运行时依赖及其许可证见 `package.json` 与 `pnpm-lock.yaml`，主要包括：

| 依赖 | 用途 | 许可证 |
|---|---|---|
| Next.js / React | 应用框架 | MIT |
| Three.js / React Three Fiber / Drei | 3D 胶卷桌面 | MIT |
| Matter.js | 胶卷物理效果 | MIT |
| Dexie | IndexedDB 封装 | Apache-2.0 |
| Framer Motion | 动效 | MIT |
| Tailwind CSS | 样式 | MIT |

## 素材

- `example/` 与演示用照片：项目作者自有素材，可随仓库分发。
- 字体：仅使用各操作系统的系统字体（Helvetica / Arial / PingFang SC / Microsoft YaHei / Georgia / Courier New），不随仓库分发字体文件。
- 公开仓库的 `data/index.json` 为**空占位索引**：检索语料的版权尚未确认，故不随公开仓库分发；本地构建索引的方式见 `scripts/build-index.mjs`。
