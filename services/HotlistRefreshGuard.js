/**
 * 热榜刷新保护器。
 * 用于限制同一个热榜 type 的重复刷新，并在并发请求下复用同一次外部调用结果。
 */
class HotlistRefreshGuard {
  constructor() {
    this.inflight = new Map();
    this.lastRunAt = new Map();
  }

  /**
   * 读取当前热榜刷新冷却时间。
   */
  getCooldownMs() {
    const fromMs = Number(process.env.HOTLIST_REFRESH_COOLDOWN_MS || 0);
    if (Number.isFinite(fromMs) && fromMs > 0) return fromMs;
    const fromSec = Number(process.env.HOTLIST_REFRESH_COOLDOWN_SEC || 60);
    return Math.max(1, fromSec) * 1000;
  }

  /**
   * 在冷却和并发保护下执行一次热榜刷新任务。
   */
  async run(type, runner) {
    const cooldownMs = this.getCooldownMs();
    const now = Date.now();
    const inflight = this.inflight.get(type);
    if (inflight) {
      console.log(`[hotlist-guard] join inflight type=${type}`);
      const result = await inflight;
      return { status: 'joined', result, remainingMs: 0 };
    }

    const lastRunAt = this.lastRunAt.get(type);
    if (lastRunAt && now - lastRunAt < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastRunAt);
      console.log(`[hotlist-guard] cooldown type=${type} remainingMs=${remainingMs}`);
      return { status: 'cooldown', result: null, remainingMs };
    }

    const task = (async () => {
      const result = await runner();
      this.lastRunAt.set(type, Date.now());
      return result;
    })();

    this.inflight.set(type, task);
    try {
      const result = await task;
      return { status: 'executed', result, remainingMs: 0 };
    } finally {
      this.inflight.delete(type);
    }
  }
}

module.exports = new HotlistRefreshGuard();
