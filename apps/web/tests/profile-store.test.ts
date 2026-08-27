import {
  clearEncryptedApiKey,
  hasEncryptedApiKey,
  loadEncryptedApiKey,
  normalizeCompletionUrl,
  storeEncryptedApiKey,
} from '../src/lib/profile-store'

describe('remote BYOK endpoint normalization', () => {
  it('appends the OpenAI-compatible completions path', () => {
    expect(normalizeCompletionUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/chat/completions',
    )
  })
  it('allows a local endpoint for on-device gateway experimentation', () => {
    expect(normalizeCompletionUrl('http://localhost:11434/v1')).toBe(
      'http://localhost:11434/v1/chat/completions',
    )
  })
  it('rejects an insecure remote endpoint', () => {
    expect(() => normalizeCompletionUrl('http://example.com/v1')).toThrow('Use an HTTPS endpoint')
  })
})

describe('encrypted BYOK vault', () => {
  beforeEach(() => localStorage.clear())
  it('stores an encrypted key and unlocks it only with the matching passphrase', async () => {
    await storeEncryptedApiKey('sk-local-example', 'safe password')
    expect(hasEncryptedApiKey()).toBe(true)
    expect(localStorage.getItem('genoffice-web-byok-v1')).not.toContain('sk-local-example')
    await expect(loadEncryptedApiKey('safe password')).resolves.toBe('sk-local-example')
    await expect(loadEncryptedApiKey('wrong password')).rejects.toThrow('could not unlock')
  })
  it('removes the encrypted local key', async () => {
    await storeEncryptedApiKey('sk-local-example', 'safe password')
    clearEncryptedApiKey()
    expect(hasEncryptedApiKey()).toBe(false)
  })
})
