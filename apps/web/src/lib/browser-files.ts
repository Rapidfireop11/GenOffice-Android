import { parseDocx } from '@genoffice/docx-engine'

export type LocalFormat = 'markdown' | 'text' | 'docx-preview'

export interface BrowserWritable {
  write(data: Blob | string): Promise<void>
  close(): Promise<void>
}

export interface BrowserFileHandle {
  kind: 'file'
  name: string
  getFile(): Promise<File>
  createWritable?: () => Promise<BrowserWritable>
}

interface PickerWindow extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>
}

interface OpfsFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<BrowserWritable>
}

interface OpfsDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>
}

export interface LocalDocument {
  id: string
  name: string
  content: string
  format: LocalFormat
  handle?: BrowserFileHandle
}

const ACCEPTED_FILE_TYPES = [
  {
    description: 'Office and text documents',
    accept: {
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  },
]

function newId(): string {
  return crypto.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function blocksToPlainText(blocks: Awaited<ReturnType<typeof parseDocx>>['blocks']): string {
  return blocks
    .map((block) => {
      const richText = block.runs?.map((run) => run.text ?? '').join('') ?? ''
      if (richText.trim()) return richText
      if (block.previewText?.trim()) return block.previewText
      return block.type === 'image' ? '[Image]' : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

async function readFile(file: File, handle?: BrowserFileHandle): Promise<LocalDocument> {
  const ext = extensionOf(file.name)
  if (ext === 'docx') {
    const parsed = await parseDocx(new Uint8Array(await file.arrayBuffer()))
    return {
      id: newId(),
      name: file.name,
      content: blocksToPlainText(parsed.blocks),
      format: 'docx-preview',
      handle,
    }
  }
  return {
    id: newId(),
    name: file.name,
    content: await file.text(),
    format: ext === 'md' || ext === 'markdown' ? 'markdown' : 'text',
    handle,
  }
}

function fallbackOpen(): Promise<LocalDocument | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx,.md,.markdown,.txt'
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        void readFile(file)
          .then(resolve)
          .catch(() => resolve(null))
      },
      { once: true },
    )
    input.click()
  })
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in (window as PickerWindow)
}

export async function openLocalDocument(): Promise<LocalDocument | null> {
  const picker = (window as PickerWindow).showOpenFilePicker
  if (!picker) return fallbackOpen()
  try {
    const [handle] = await picker({ multiple: false, types: ACCEPTED_FILE_TYPES })
    return handle ? readFile(await handle.getFile(), handle) : null
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

export async function saveLocalDocument(document: LocalDocument): Promise<LocalDocument> {
  if (document.format === 'docx-preview')
    throw new Error(
      'DOCX files are opened as a local preview in this browser workspace. Save edits as Markdown to avoid losing document fidelity.',
    )
  const contents = new Blob([document.content], {
    type:
      document.format === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
  })
  if (document.handle?.createWritable) {
    const writable = await document.handle.createWritable()
    await writable.write(contents)
    await writable.close()
    return document
  }
  const savePicker = (window as PickerWindow).showSaveFilePicker
  if (savePicker) {
    const extension = document.format === 'markdown' ? '.md' : '.txt'
    const handle = await savePicker({
      suggestedName: document.name.endsWith(extension)
        ? document.name
        : `${document.name}${extension}`,
      types: ACCEPTED_FILE_TYPES,
    })
    const writable = await handle.createWritable?.()
    if (!writable) throw new Error('This browser cannot write the selected file directly.')
    await writable.write(contents)
    await writable.close()
    return { ...document, handle, name: handle.name }
  }
  downloadLocalDocument(document)
  return document
}

export function downloadLocalDocument(localDocument: LocalDocument): void {
  const ext = localDocument.format === 'markdown' ? '.md' : '.txt'
  const name = localDocument.name.endsWith(ext)
    ? localDocument.name
    : `${localDocument.name.replace(/\.[^.]+$/, '')}${ext}`
  const blob = new Blob([localDocument.content], { type: 'text/plain;charset=utf-8' })
  const anchor = window.document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(anchor.href), 0)
}

async function getOpfsFile(name: string): Promise<OpfsFileHandle | null> {
  const manager = navigator.storage as unknown as {
    getDirectory?: () => Promise<OpfsDirectoryHandle>
  }
  if (!manager.getDirectory) return null
  return (await manager.getDirectory()).getFileHandle(name, { create: true })
}

export async function saveWorkingCopy(
  document: Pick<LocalDocument, 'id' | 'name' | 'content' | 'format'>,
): Promise<boolean> {
  const file = await getOpfsFile(`genoffice-web-${document.id}.json`)
  if (!file) return false
  const writable = await file.createWritable()
  await writable.write(JSON.stringify(document))
  await writable.close()
  return true
}

export async function loadWorkingCopy(id: string): Promise<LocalDocument | null> {
  try {
    const file = await getOpfsFile(`genoffice-web-${id}.json`)
    if (!file) return null
    const text = await (await file.getFile()).text()
    if (!text) return null
    const candidate = JSON.parse(text) as LocalDocument
    return candidate.id && typeof candidate.content === 'string' ? candidate : null
  } catch {
    return null
  }
}
