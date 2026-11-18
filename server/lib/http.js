import { timingSafeEqual } from 'node:crypto'
import { createLicenseService, LicenseError } from './core.js'
import { upstashStorage } from './storage.js'

let servicePromise = null
let storageRef = null

/** Lets the local dev server and tests swap in memory storage. */
export function useStorage(storage) {
  storageRef = storage
  servicePromise = null
}

async function context() {
  if (!servicePromise) {
    servicePromise = (async () => {
      const storage = storageRef ?? (await upstashStorage())
      const privateKey = process.env.LICENSE_PRIVATE_KEY
      if (!privateKey) throw new Error('Configure LICENSE_PRIVATE_KEY')
      return { storage, service: createLicenseService({ storage, privateKey }) }
    })()
  }
  return servicePromise
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function isAdmin(req) {
  const secret = process.env.ADMIN_SECRET
  const given = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!secret || secret.length < 16 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Wraps a route: POST only, JSON body, per-IP rate limit for public routes,
 * Bearer ADMIN_SECRET for admin routes, and uniform { error, message } failures.
 */
export function route(fn, { admin = false, limit = 30 } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed', message: 'Use POST.' })
      if (admin && !isAdmin(req)) return send(res, 401, { error: 'unauthorized', message: 'Senha de administrador inválida.' })
      const { storage, service } = await context()
      if (!admin) {
        const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
        if ((await storage.hit(`rate:${ip}`, 600)) > limit)
          return send(res, 429, { error: 'rate_limited', message: 'Muitas tentativas. Aguarde alguns minutos.' })
      }
      const body = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}')
      return send(res, 200, await fn(service, body))
    } catch (err) {
      if (err instanceof LicenseError) return send(res, err.status, { error: err.code, message: err.message })
      console.error(err)
      return send(res, 500, { error: 'server_error', message: 'Erro no servidor de licenças.' })
    }
  }
}
