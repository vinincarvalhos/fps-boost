import { route } from '../../lib/http.js'
// POST (Bearer ADMIN_SECRET) { key } -> license with machines
export default route((s, b) => s.info(b), { admin: true })
