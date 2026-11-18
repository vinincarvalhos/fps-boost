// Generates the Ed25519 key pair and an admin secret.
// Private key + admin secret go to the server environment (never into the app or git);
// the public key goes into the app (src/main/services/license-key.ts).
import { randomBytes } from 'node:crypto'
import { generateKeyPair } from '../lib/token.js'

const { privateKey, publicKey } = generateKeyPair()
console.log(`LICENSE_PRIVATE_KEY=${privateKey}`)
console.log(`ADMIN_SECRET=${randomBytes(24).toString('base64url')}`)
console.log(`# chave pública para o app:`)
console.log(`LICENSE_PUBLIC_KEY=${publicKey}`)
