import { Redis } from 'ioredis';

/** Counts hits per key in fixed windows (TL-40, E-121). */
export interface Counter {
  /** Adds one hit and returns the hits in the current window. */
  hit(key: string, windowSeconds: number): Promise<number>;
  close(): Promise<void>;
}

/** Per API instance; with several instances each counts on its own. */
export class MemoryCounter implements Counter {
  private readonly windows = new Map<string, { until: number; hits: number }>();
  private readonly sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of this.windows) if (window.until <= now) this.windows.delete(key);
  }, 60_000);

  constructor() {
    this.sweep.unref();
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const window = this.windows.get(key);
    if (!window || window.until <= now) {
      this.windows.set(key, { until: now + windowSeconds * 1000, hits: 1 });
      return 1;
    }
    window.hits += 1;
    return window.hits;
  }

  async close(): Promise<void> {
    clearInterval(this.sweep);
  }
}

/** Shared by all instances through Valkey; falls back to memory while Valkey is away. */
export class ValkeyCounter implements Counter {
  private readonly client: Redis;
  private readonly fallback = new MemoryCounter();

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Connection errors are retried by the client; requests use the fallback meanwhile.
    this.client.on('error', () => undefined);
  }

  async hit(key: string, windowSeconds: number): Promise<number> {
    if (this.client.status !== 'ready') return this.fallback.hit(key, windowSeconds);
    try {
      const window = Math.floor(Date.now() / 1000 / windowSeconds);
      const name = `tasklore:rl:${key}:${window}`;
      const [[, hits]] = (await this.client
        .multi()
        .incr(name)
        .expire(name, windowSeconds + 5)
        .exec()) as [[Error | null, number], [Error | null, number]];
      return hits;
    } catch {
      return this.fallback.hit(key, windowSeconds);
    }
  }

  async close(): Promise<void> {
    await this.fallback.close();
    this.client.disconnect();
  }
}
