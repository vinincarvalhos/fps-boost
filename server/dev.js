// Local license server with in-memory storage (data is lost on restart).
// Usage: node dev.js   (reads LICENSE_PRIVATE_KEY and ADMIN_SECRET from .env.local)
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { useStorage } from './lib/http.js'
import { memoryStorage } from './lib/storage.js'

if (existsSync(new URL('./.env.local', import.meta.url))) {
  for (const line of readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
useStorage(memoryStorage())

const routes = {
  '/api/activate': './api/activate.js',
  '/api/validate': './api/validate.js',
  '/api/deactivate': './api/deactivate.js',
  '/api/admin/keys': './api/admin/keys.js',
  '/api/admin/status': './api/admin/status.js',
  '/api/admin/info': './api/admin/info.js'
}

const port = Number(process.env.PORT ?? 3005)
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (!routes[path]) {
    res.statusCode = 404
    return res.end('{"error":"not_found"}')
  }
  let raw = ''
  for await (const chunk of req) raw += chunk
  req.body = raw
  const handler = (await import(routes[path])).default
  return handler(req, res)
}).listen(port, '127.0.0.1', () => console.log(`Servidor de licenças local em http://127.0.0.1:${port}`))
