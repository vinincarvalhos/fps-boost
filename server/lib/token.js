// Signed license tokens: base64url(JSON payload) + "." + base64url(Ed25519 signature).
// The server signs with the private key; the desktop app verifies offline with the public key.
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function generateKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return {
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  }
}

export function signToken(payload, privateKeyB64) {
  const key = createPrivateKey({ key: Buffer.from(privateKeyB64, 'base64'), format: 'der', type: 'pkcs8' })
  const body = b64url(JSON.stringify(payload))
  return `${body}.${b64url(sign(null, Buffer.from(body), key))}`
}

/** Returns the payload when the signature is valid, otherwise null. Does not check expiry. */
export function verifyToken(token, publicKeyB64) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
    if (!verify(null, Buffer.from(body), key, Buffer.from(sig, 'base64url'))) return null
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}
