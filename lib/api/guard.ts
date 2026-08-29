// 公网模型接口的服务端保护：
// 1. IP 级短周期限流（突发窗口）+ 每日额度（按 IP 与全局）
// 2. 请求体大小限制（在 JSON.parse 之前检查原始字节数）
// 计数保存在进程内存：适配单实例 / 少量实例部署；多实例部署应改为共享存储（Redis 等）。
// 全局每日额度可通过环境变量 AI_GLOBAL_DAILY_LIMIT 覆盖（默认 600）。

export interface LimitSpec {
  /** 路由名（用于限流键） */
  name: string;
  /** 突发窗口内允许的请求数 */
  burst: number;
  /** 突发窗口长度（毫秒） */
  burstWindowMs: number;
  /** 每个 IP 每日（UTC）允许的请求数 */
  daily: number;
}

export const FLASHBACK_LIMITS: LimitSpec = { name: "flashback", burst: 10, burstWindowMs: 60_000, daily: 200 };
export const DESCRIBE_LIMITS: LimitSpec = { name: "describe", burst: 6, burstWindowMs: 60_000, daily: 80 };
export const OPENING_LIMITS: LimitSpec = { name: "opening", burst: 8, burstWindowMs: 60_000, daily: 80 };
export const SUMMARIZE_LIMITS: LimitSpec = { name: "summarize", burst: 6, burstWindowMs: 60_000, daily: 100 };
export const DELIBERATE_LIMITS: LimitSpec = { name: "deliberate", burst: 10, burstWindowMs: 60_000, daily: 200 };

const GLOBAL_DAILY_LIMIT = Number(process.env.AI_GLOBAL_DAILY_LIMIT || 600);

const burstMap = new Map<string, { count: number; resetAt: number }>();
const dailyMap = new Map<string, { day: string; count: number }>();
let globalDaily: { day: string; count: number } = { day: utcDay(), count: 0 };

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  message?: string;
  retryAfter?: number;
}

// 返回 ok=false 时调用方应直接返回 429。
export function rateLimit(ip: string, spec: LimitSpec): RateLimitResult {
  const now = Date.now();
  const day = utcDay();

  // 每日额度：按 IP
  const daily = dailyMap.get(`${spec.name}:${ip}`);
  if (!daily || daily.day !== day) dailyMap.set(`${spec.name}:${ip}`, { day, count: 1 });
  else if (daily.count >= spec.daily) {
    return { ok: false, message: "今日调用额度已用完，请明天再试。", retryAfter: secondsUntilNextUtcDay() };
  } else daily.count += 1;

  // 全局熔断：所有 IP 共享的每日上限
  if (globalDaily.day !== day) globalDaily = { day, count: 0 };
  globalDaily.count += 1;
  if (globalDaily.count > GLOBAL_DAILY_LIMIT) {
    return { ok: false, message: "服务今日调用量已达上限，请明天再试。", retryAfter: secondsUntilNextUtcDay() };
  }

  // 突发窗口：按 IP
  const key = `${spec.name}:${ip}`;
  const bucket = burstMap.get(key);
  if (!bucket || bucket.resetAt <= now) burstMap.set(key, { count: 1, resetAt: now + spec.burstWindowMs });
  else if (bucket.count >= spec.burst) {
    return {
      ok: false,
      message: "请求过于频繁，请稍后再试。",
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  } else bucket.count += 1;

  // 简单清理：防止 Map 无限增长
  if (burstMap.size > 5000) {
    for (const [k, v] of burstMap) if (v.resetAt <= now) burstMap.delete(k);
  }
  if (dailyMap.size > 5000) {
    for (const [k, v] of dailyMap) if (v.day !== day) dailyMap.delete(k);
  }

  return { ok: true };
}

function secondsUntilNextUtcDay(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

export interface BodyResult<T> {
  ok: boolean;
  body?: T;
  response?: Response;
}

// 读取 JSON 请求体：先检查原始字节数（在 parse 之前），再解析并捕获异常 JSON。
export async function readJsonWithLimit<T>(request: Request, maxBytes: number): Promise<BodyResult<T>> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) };
  }
  const raw = await request.text();
  if (raw.length > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "请求体不是有效的 JSON。" }, { status: 400 }),
    };
  }
}

function tooLarge(maxBytes: number): Response {
  return Response.json({ error: `请求体过大（上限 ${Math.round(maxBytes / 1024)}KB）。` }, { status: 413 });
}
