import { route } from '../../lib/http.js'
// POST (Bearer ADMIN_SECRET) { count, maxMachines, expiresInDays, note } -> { keys }
export default route((s, b) => s.createKeys(b), { admin: true })
