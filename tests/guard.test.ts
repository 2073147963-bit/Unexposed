import { describe, expect, it } from "vitest";

import { rateLimit } from "@/lib/api/guard";

describe("接口限流", () => {
  it("突发窗口内超过限额后返回 429 与重试提示", () => {
    const spec = { name: "test-burst", burst: 3, burstWindowMs: 60_000, daily: 100 };
    const ip = "1.2.3.4";
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(ip, spec).ok).toBe(true);
    }
    const blocked = rateLimit(ip, spec);
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("请求过于频繁");
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("不同 IP 互不影响", () => {
    const spec = { name: "test-ip", burst: 1, burstWindowMs: 60_000, daily: 100 };
    expect(rateLimit("5.6.7.8", spec).ok).toBe(true);
    expect(rateLimit("9.10.11.12", spec).ok).toBe(true);
  });
});
