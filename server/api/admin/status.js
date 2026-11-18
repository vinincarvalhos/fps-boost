import { route } from '../../lib/http.js'
// POST (Bearer ADMIN_SECRET) { key, status: "active" | "revoked" } -> license
export default route((s, b) => s.setStatus(b), { admin: true })
