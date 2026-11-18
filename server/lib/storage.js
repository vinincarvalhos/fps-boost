// Storage backends. Licenses are stored as one JSON object per key: `license:<KEY>`.

/** Upstash Redis (production). Reads UPSTASH_REDIS_REST_URL / _TOKEN or the Vercel KV equivalents. */
export async function upstashStorage() {
  const { Redis } = await import('@upstash/redis')
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN')
  const redis = new Redis({ url, token })
  return {
    get: (k) => redis.get(k),
    set: (k, v) => redis.set(k, v),
    /** keys matching a prefix (admin listing only) */
    keys: (prefix) => redis.keys(`${prefix}*`),
    /** increments a counter that expires after `ttlSec`; returns the new value */
    async hit(k, ttlSec) {
      const n = await redis.incr(k)
      if (n === 1) await redis.expire(k, ttlSec)
      return n
    }
  }
}

/** In-memory storage for tests and the local dev server. */
export function memoryStorage() {
  const data = new Map()
  const counters = new Map()
  return {
    async get(k) {
      return data.has(k) ? structuredClone(data.get(k)) : null
    },
    async set(k, v) {
      data.set(k, structuredClone(v))
    },
    async keys(prefix) {
      return [...data.keys()].filter((k) => k.startsWith(prefix))
    },
    async hit(k, ttlSec) {
      const now = Date.now()
      const c = counters.get(k)
      if (!c || c.until < now) {
        counters.set(k, { n: 1, until: now + ttlSec * 1000 })
        return 1
      }
      c.n++
      return c.n
    }
  }
}
