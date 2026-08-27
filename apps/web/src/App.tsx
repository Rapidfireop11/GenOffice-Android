import { useEffect, useRef, useState } from 'react'
import { PrecisionCursor } from './components/PrecisionCursor'
import { ProfileMenu } from './components/ProfileMenu'
import {
  downloadLocalDocument,
  loadWorkingCopy,
  openLocalDocument,
  saveLocalDocument,
  saveWorkingCopy,
  supportsFileSystemAccess,
  type LocalDocument,
} from './lib/browser-files'
import { assessLocalAiCapability, generateLocalText, type LocalAiCapability } from './lib/local-ai'
import {
  loadProfile,
  normalizeCompletionUrl,
  saveProfile,
  type WebProfile,
} from './lib/profile-store'

const ACTIVE_DOCUMENT_ID = 'active-browser-workspace'
const BLANK_DOCUMENT: LocalDocument = {
  id: ACTIVE_DOCUMENT_ID,
  name: 'Untitled.md',
  format: 'markdown',
  content:
    '# Untitled document\n\nStart writing here. Your working copy is saved locally on this device.\n',
}
function applySelectionAction(
  textarea: HTMLTextAreaElement | null,
  value: string,
  before: string,
  after = before,
): string {
  if (!textarea) return `${value}${before}${after}`
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end) || 'text'
  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
  return next
}
const contentForPrompt = (document: LocalDocument) =>
  document.content.length > 14000
    ? `${document.content.slice(0, 14000)}\n\n[Document truncated locally for this request]`
    : document.content

export function App() {
  const workspaceRef = useRef<HTMLElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [document, setDocument] = useState<LocalDocument>(BLANK_DOCUMENT)
  const [profile, setProfile] = useState<WebProfile>(() => loadProfile())
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('Local working copy ready.')
  const [task, setTask] = useState('Summarize the draft in five concise points.')
  const [aiOutput, setAiOutput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [cursorEnabled, setCursorEnabled] = useState(false)
  const [localCapability, setLocalCapability] = useState<LocalAiCapability | null>(null)
  useEffect(() => {
    void loadWorkingCopy(ACTIVE_DOCUMENT_ID).then((workingCopy) => {
      if (workingCopy) {
        setDocument({ ...workingCopy, id: ACTIVE_DOCUMENT_ID })
        setStatus('Recovered local working copy from this device.')
      }
    })
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveWorkingCopy({ ...document, id: ACTIVE_DOCUMENT_ID })
        .then((saved) => saved && setStatus('Saved locally on this device.'))
        .catch(() => setStatus('Working copy could not be saved to browser storage.'))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [document])
  const updateProfile = (next: WebProfile) => {
    setProfile(next)
    saveProfile(next)
  }
  const open = async () => {
    try {
      const next = await openLocalDocument()
      if (!next) return
      setDocument({ ...next, id: ACTIVE_DOCUMENT_ID })
      setStatus(
        next.format === 'docx-preview'
          ? 'DOCX content extracted locally. Save edits as Markdown to retain original formatting safely.'
          : `Opened ${next.name} locally.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not open that file.')
    }
  }
  const save = async () => {
    try {
      const saved = await saveLocalDocument(document)
      setDocument(saved)
      setStatus(`Saved ${saved.name} on this device.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save that file.')
    }
  }
  const runAi = async (mode: 'local' | 'remote') => {
    if (!task.trim()) {
      setStatus('Describe the assistance you want before running AI.')
      return
    }
    setAiBusy(true)
    setAiOutput('')
    try {
      const prompt = `${task}\n\nDocument:\n${contentForPrompt(document)}`
      if (mode === 'local') {
        const capability = assessLocalAiCapability()
        setLocalCapability(capability)
        if (!capability.compatible) throw new Error(capability.explanation)
        const output = await generateLocalText({
          model: profile.localModelId,
          system:
            'You are a careful writing assistant. Return only the requested document-oriented result. Never claim to have saved a file.',
          prompt,
          onProgress: (message) => setStatus(message),
        })
        setAiOutput(output)
        setStatus('Local AI response completed on this device.')
      } else {
        if (!apiKey.trim())
          throw new Error(
            'Enter and unlock a BYOK API key in Profile before using remote assistance.',
          )
        if (!profile.remote.endpoint.trim() || !profile.remote.model.trim())
          throw new Error(
            'Configure an OpenAI-compatible endpoint and model in Profile before using remote assistance.',
          )
        const response = await fetch(normalizeCompletionUrl(profile.remote.endpoint), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
          body: JSON.stringify({
            model: profile.remote.model.trim(),
            messages: [
              {
                role: 'system',
                content:
                  'You are a careful writing assistant. Return only the requested document-oriented result.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.35,
          }),
        })
        if (!response.ok)
          throw new Error(
            `Remote provider returned ${response.status}. Check the endpoint, browser CORS policy, model, and key.`,
          )
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        setAiOutput(
          data.choices?.[0]?.message?.content?.trim() ?? 'The remote provider returned no text.',
        )
        setStatus('Remote BYOK response completed.')
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'AI assistance failed.')
    } finally {
      setAiBusy(false)
    }
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            RapidOffice <em>Web</em>
          </span>
        </div>
        <div className="connection-state">
          <span className="state-dot" />
          Local-first workspace
        </div>
        <ProfileMenu
          profile={profile}
          onProfileChange={updateProfile}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
        />
      </header>
      <section className="workspace" ref={workspaceRef}>
        <aside className="left-rail" aria-label="Document actions">
          <button className="rail-button active" type="button" aria-label="Document workspace">
            <span>▤</span>
            <small>Write</small>
          </button>
          <button
            className="rail-button"
            type="button"
            onClick={() => void open()}
            aria-label="Open a local document"
          >
            <span>↗</span>
            <small>Open</small>
          </button>
          <button
            className="rail-button"
            type="button"
            onClick={() => setCursorEnabled((value) => !value)}
            aria-label="Toggle precision cursor"
            aria-pressed={cursorEnabled}
          >
            <span>⌖</span>
            <small>Cursor</small>
          </button>
        </aside>
        <section className="editor-column" aria-label="Document editor">
          <div className="document-toolbar">
            <div className="file-title">
              <span className="file-status-dot" />
              <input
                aria-label="Document name"
                value={document.name}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="toolbar-actions">
              <button className="quiet-button" type="button" onClick={() => void open()}>
                Open
              </button>
              <button
                className="quiet-button"
                type="button"
                onClick={() => setDocument({ ...BLANK_DOCUMENT })}
              >
                New
              </button>
              <button className="primary-button" type="button" onClick={() => void save()}>
                Save
              </button>
            </div>
          </div>
          <div className="format-toolbar" aria-label="Editor format toolbar">
            <button
              type="button"
              onClick={() =>
                setDocument((current) => ({
                  ...current,
                  content: applySelectionAction(editorRef.current, current.content, '**'),
                }))
              }
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              onClick={() =>
                setDocument((current) => ({
                  ...current,
                  content: applySelectionAction(editorRef.current, current.content, '*'),
                }))
              }
            >
              <i>I</i>
            </button>
            <button
              type="button"
              onClick={() =>
                setDocument((current) => ({ ...current, content: `${current.content}\n- ` }))
              }
            >
              List
            </button>
            <button
              type="button"
              onClick={() =>
                setDocument((current) => ({ ...current, content: `${current.content}\n## ` }))
              }
            >
              Heading
            </button>
            <span className="format-divider" />
            <button type="button" onClick={() => downloadLocalDocument(document)}>
              Export copy
            </button>
          </div>
          <div className="page-frame">
            <textarea
              ref={editorRef}
              className="document-editor"
              value={document.content}
              onChange={(event) =>
                setDocument((current) => ({ ...current, content: event.target.value }))
              }
              spellCheck
              aria-label="Document content"
            />
            {document.format === 'docx-preview' && (
              <p className="docx-notice">
                This is a browser-local text extraction from a DOCX. The original file has not been
                changed. Save the edited result as Markdown, or use the desktop editor for lossless
                DOCX round-tripping.
              </p>
            )}
          </div>
          <footer className="editor-status">
            <span>{status}</span>
            <span>
              {supportsFileSystemAccess()
                ? 'Direct local save supported'
                : 'Download fallback active'}
            </span>
          </footer>
        </section>
        <aside className="ai-panel" aria-label="AI assistance">
          <div className="panel-heading">
            <p className="eyebrow">Assist</p>
            <h1>Make the next edit clearer.</h1>
            <p>Choose a private local model or your own remote provider.</p>
          </div>
          <label className="task-label">
            Task
            <textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              rows={4}
              placeholder="Describe the change you want"
            />
          </label>
          <div className="ai-buttons">
            <button
              className="primary-button wide"
              type="button"
              disabled={aiBusy}
              onClick={() => void runAi('local')}
            >
              {aiBusy ? 'Working…' : 'Run on this device'}
            </button>
            <button
              className="secondary-button wide"
              type="button"
              disabled={aiBusy}
              onClick={() => void runAi('remote')}
            >
              Use BYOK provider
            </button>
          </div>
          {localCapability && (
            <p className={`local-status ${localCapability.compatible ? 'ok' : 'warning'}`}>
              {localCapability.explanation}
            </p>
          )}
          {aiOutput && (
            <div className="ai-result">
              <div className="result-head">
                <span>Result</span>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() =>
                    setDocument((current) => ({
                      ...current,
                      content: `${current.content.trimEnd()}\n\n${aiOutput}\n`,
                    }))
                  }
                >
                  Insert
                </button>
              </div>
              <pre>{aiOutput}</pre>
            </div>
          )}
          <div className="privacy-card">
            <strong>Nothing autosaves to a server.</strong>
            <p>
              Your draft and browser cache remain local. A remote prompt is sent only when you use a
              configured BYOK provider.
            </p>
          </div>
        </aside>
      </section>
      <PrecisionCursor
        enabled={cursorEnabled}
        sensitivity={profile.cursorSensitivity}
        workspaceRef={workspaceRef}
        onClose={() => setCursorEnabled(false)}
      />
    </main>
  )
}
