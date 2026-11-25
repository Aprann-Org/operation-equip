// Server-side only (node:crypto): used by the intake API route and settings actions.
import { createHash, randomBytes } from 'node:crypto'

/** Recognisable prefix, so a leaked key is easy to identify in logs and secret scanners. */
const KEY_PREFIX = 'oeq_'

/** How much of the key the settings list shows. Enough to tell keys apart, not to use one. */
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 6

export function hashIntakeKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** A fresh key: 256 random bits. Only the hash and display prefix are ever stored. */
export function generateIntakeKey(): { key: string; prefix: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString('base64url')
  return { key, prefix: key.slice(0, DISPLAY_PREFIX_LENGTH), hash: hashIntakeKey(key) }
}

/** Pulls the key from `Authorization: Bearer <key>`, or null if absent or malformed. */
export function readBearerKey(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) return null
  const key = match[1]
  return key.startsWith(KEY_PREFIX) && key.length < 200 ? key : null
}
