export type RemoteProviderId =
  'openai-compatible' | 'openai' | 'anthropic' | 'gemini' | 'openrouter'
export interface RemoteAiSettings {
  provider: RemoteProviderId
  endpoint: string
  model: string
  rememberKey: boolean
}
export interface WebProfile {
  remote: RemoteAiSettings
  localModelId: string
  cursorSensitivity: number
}
const PROFILE_KEY = 'genoffice-web-profile-v1'
const VAULT_KEY = 'genoffice-web-byok-v1'

export const DEFAULT_PROFILE: WebProfile = {
  remote: { provider: 'openai-compatible', endpoint: '', model: '', rememberKey: false },
  localModelId: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  cursorSensitivity: 1.2,
}

export function loadProfile(): WebProfile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '') as Partial<WebProfile>
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      remote: { ...DEFAULT_PROFILE.remote, ...parsed.remote },
    }
  } catch {
    return DEFAULT_PROFILE
  }
}
export function saveProfile(profile: WebProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
}
function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}
async function deriveVaultKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 150000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
export async function storeEncryptedApiKey(apiKey: string, passphrase: string): Promise<void> {
  if (passphrase.length < 8)
    throw new Error('Use a passphrase with at least 8 characters to store a key locally.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveVaultKey(passphrase, salt)
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(apiKey)),
  )
  localStorage.setItem(
    VAULT_KEY,
    JSON.stringify({ salt: toBase64(salt), iv: toBase64(iv), encrypted: toBase64(encrypted) }),
  )
}
export async function loadEncryptedApiKey(passphrase: string): Promise<string> {
  const stored = localStorage.getItem(VAULT_KEY)
  if (!stored) throw new Error('No locally stored API key was found.')
  try {
    const record = JSON.parse(stored) as { salt: string; iv: string; encrypted: string }
    const key = await deriveVaultKey(passphrase, fromBase64(record.salt))
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(record.iv) as unknown as BufferSource },
      key,
      fromBase64(record.encrypted) as unknown as BufferSource,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('The passphrase could not unlock the locally stored API key.')
  }
}
export function clearEncryptedApiKey(): void {
  localStorage.removeItem(VAULT_KEY)
}
export function hasEncryptedApiKey(): boolean {
  return Boolean(localStorage.getItem(VAULT_KEY))
}
export function normalizeCompletionUrl(endpoint: string): string {
  const url = new URL(endpoint.trim())
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !isLocal)
    throw new Error('Use an HTTPS endpoint, or a local server running on localhost.')
  const path = url.pathname.replace(/\/$/, '')
  if (!path.endsWith('/chat/completions')) url.pathname = `${path}/chat/completions`
  return url.toString()
}
