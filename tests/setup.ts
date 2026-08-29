// 测试环境准备：注册 fake-indexeddb，并为 getDatabase 的浏览器判定补一个 window 别名。
import "fake-indexeddb/auto";

(globalThis as unknown as { window: unknown }).window = globalThis;
