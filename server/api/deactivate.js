import { route } from '../lib/http.js'
// POST { key, machineId } -> { ok }
export default route((s, b) => s.deactivate(b), { limit: 20 })
