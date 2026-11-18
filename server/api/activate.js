import { route } from '../lib/http.js'
// POST { key, machineId, machineName } -> { token, license }
export default route((s, b) => s.activate(b), { limit: 20 })
