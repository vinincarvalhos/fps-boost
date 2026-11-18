import { route } from '../lib/http.js'
// POST { key, machineId } -> { token, license }
export default route((s, b) => s.validate(b), { limit: 60 })
