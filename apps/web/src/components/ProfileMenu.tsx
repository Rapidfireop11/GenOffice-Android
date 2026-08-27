import { useEffect, useState } from 'react'
import {
  LOCAL_MODELS,
  assessLocalAiCapability,
  selectedLocalModel,
  type LocalAiCapability,
} from '../lib/local-ai'
import {
  clearEncryptedApiKey,
  hasEncryptedApiKey,
  loadEncryptedApiKey,
  storeEncryptedApiKey,
  type WebProfile,
} from '../lib/profile-store'

interface ProfileMenuProps {
  profile: WebProfile
  onProfileChange: (profile: WebProfile) => void
  apiKey: string
  onApiKeyChange: (value: string) => void
}
const PROVIDERS = [
  { value: 'openai-compatible', label: 'OpenAI-compatible endpoint' },
  { value: 'openai', label: 'OpenAI API' },
  { value: 'anthropic', label: 'Anthropic API' },
  { value: 'gemini', label: 'Gemini API' },
  { value: 'openrouter', label: 'OpenRouter API' },
] as const

export function ProfileMenu({
  profile,
  onProfileChange,
  apiKey,
  onApiKeyChange,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const [vaultPassphrase, setVaultPassphrase] = useState('')
  const [notice, setNotice] = useState('')
  const [capability, setCapability] = useState<LocalAiCapability | null>(null)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])
  const updateRemote = (patch: Partial<WebProfile['remote']>) => {
    onProfileChange({ ...profile, remote: { ...profile.remote, ...patch } })
    setNotice('Profile settings updated locally.')
  }
  const saveKey = async () => {
    try {
      if (!apiKey.trim()) throw new Error('Enter an API key before storing it.')
      await storeEncryptedApiKey(apiKey.trim(), vaultPassphrase)
      updateRemote({ rememberKey: true })
      setVaultPassphrase('')
      setNotice('API key stored in this browser with your passphrase.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not store the API key.')
    }
  }
  const unlockKey = async () => {
    try {
      onApiKeyChange(await loadEncryptedApiKey(vaultPassphrase))
      setVaultPassphrase('')
      setNotice('API key unlocked for this session only.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not unlock the API key.')
    }
  }
  const clearKey = () => {
    clearEncryptedApiKey()
    onApiKeyChange('')
    updateRemote({ rememberKey: false })
    setNotice('The locally stored API key was removed.')
  }
  const model = selectedLocalModel(profile.localModelId)
  return (
    <div className="profile-menu">
      <button
        className="profile-trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="profile-avatar" aria-hidden="true">
          R
        </span>
        <span className="profile-copy">
          <strong>Profile</strong>
          <small>Private settings</small>
        </span>
      </button>
      {open && (
        <div
          className="profile-popover"
          role="dialog"
          aria-modal="false"
          aria-label="Profile and AI settings"
        >
          <div className="profile-head">
            <div>
              <p className="eyebrow">Profile</p>
              <h2>AI & device controls</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close profile menu"
            >
              ×
            </button>
          </div>
          <p className="privacy-note">
            Keys and working copies stay in your browser. Only a prompt you send to a configured
            provider leaves this device.
          </p>
          <section className="profile-section">
            <div className="section-label">
              <span>Bring your own key</span>
              <em>Optional remote assistance</em>
            </div>
            <label>
              Provider
              <select
                value={profile.remote.provider}
                onChange={(event) =>
                  updateRemote({ provider: event.target.value as WebProfile['remote']['provider'] })
                }
              >
                {PROVIDERS.map((provider) => (
                  <option value={provider.value} key={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Endpoint
              <input
                value={profile.remote.endpoint}
                onChange={(event) => updateRemote({ endpoint: event.target.value })}
                placeholder="https://api.example.com/v1"
                inputMode="url"
                autoComplete="off"
              />
            </label>
            <label>
              Model
              <input
                value={profile.remote.model}
                onChange={(event) => updateRemote({ model: event.target.value })}
                placeholder="model-id"
                autoComplete="off"
              />
            </label>
            <label>
              API key
              <input
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
                type="password"
                placeholder="Stored in memory unless you choose otherwise"
                autoComplete="off"
              />
            </label>
            <label>
              Vault passphrase
              <input
                value={vaultPassphrase}
                onChange={(event) => setVaultPassphrase(event.target.value)}
                type="password"
                placeholder="Required to save or unlock a local key"
                autoComplete="new-password"
              />
            </label>
            <div className="profile-actions">
              <button className="secondary-button" type="button" onClick={() => void saveKey()}>
                Store encrypted
              </button>
              {hasEncryptedApiKey() && (
                <button className="secondary-button" type="button" onClick={() => void unlockKey()}>
                  Unlock saved key
                </button>
              )}
              {hasEncryptedApiKey() && (
                <button className="quiet-button danger" type="button" onClick={clearKey}>
                  Remove key
                </button>
              )}
            </div>
            <p className="field-hint">
              Remote endpoints must support browser CORS. HTTPS is required except for localhost.
            </p>
          </section>
          <section className="profile-section">
            <div className="section-label">
              <span>Offline on-device AI</span>
              <em>No API key</em>
            </div>
            <label>
              Local model
              <select
                value={profile.localModelId}
                onChange={(event) =>
                  onProfileChange({ ...profile, localModelId: event.target.value })
                }
              >
                {LOCAL_MODELS.map((localModel) => (
                  <option key={localModel.id} value={localModel.id}>
                    {localModel.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              {model.description} Recommended device memory: {model.minimumMemoryGb} GB or more.
            </p>
            <div className="profile-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCapability(assessLocalAiCapability())}
              >
                Check this device
              </button>
            </div>
            {capability && (
              <p className={`capability ${capability.compatible ? 'ok' : 'warning'}`}>
                {capability.explanation}
              </p>
            )}
          </section>
          <section className="profile-section compact">
            <div className="section-label">
              <span>Precision cursor</span>
              <em>Trackpad sensitivity</em>
            </div>
            <label className="range-label">
              <span>Slower</span>
              <input
                type="range"
                min="0.6"
                max="2"
                step="0.1"
                value={profile.cursorSensitivity}
                onChange={(event) =>
                  onProfileChange({ ...profile, cursorSensitivity: Number(event.target.value) })
                }
              />
              <span>Faster</span>
            </label>
          </section>
          {notice && (
            <p className="profile-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
