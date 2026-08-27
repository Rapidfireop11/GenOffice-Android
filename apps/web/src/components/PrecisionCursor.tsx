import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

interface PrecisionCursorProps {
  enabled: boolean
  sensitivity: number
  workspaceRef: RefObject<HTMLElement | null>
  onClose: () => void
}

interface Point {
  x: number
  y: number
}
export interface TextAreaMetrics {
  left: number
  top: number
  width: number
  paddingLeft: number
  paddingTop: number
  lineHeight: number
  charWidth: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function moveCursor(
  current: Point,
  delta: Point,
  bounds: DOMRect,
  sensitivity: number,
): Point {
  return {
    x: clamp(current.x + delta.x * sensitivity, bounds.left + 8, bounds.right - 8),
    y: clamp(current.y + delta.y * sensitivity, bounds.top + 8, bounds.bottom - 8),
  }
}

/** Maps a virtual cursor point to a usable textarea caret location without requiring platform-specific APIs. */
export function textOffsetAtPoint(value: string, point: Point, metrics: TextAreaMetrics): number {
  const lines = value.split('\n')
  const lineIndex = clamp(
    Math.floor((point.y - metrics.top - metrics.paddingTop) / metrics.lineHeight),
    0,
    lines.length - 1,
  )
  const column = clamp(
    Math.round((point.x - metrics.left - metrics.paddingLeft) / metrics.charWidth),
    0,
    lines[lineIndex].length,
  )
  return lines.slice(0, lineIndex).reduce((total, line) => total + line.length + 1, 0) + column
}

export function wordRangeAt(value: string, offset: number): [number, number] {
  const isWord = (character: string | undefined) =>
    Boolean(character && /[\p{L}\p{N}_-]/u.test(character))
  let start = clamp(offset, 0, value.length)
  let end = start
  while (start > 0 && isWord(value[start - 1])) start -= 1
  while (end < value.length && isWord(value[end])) end += 1
  return [start, end]
}

function placeTextareaSelection(
  textarea: HTMLTextAreaElement,
  point: Point,
  selectWord: boolean,
): void {
  const style = getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()
  const fontSize = Number.parseFloat(style.fontSize) || 16
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.75
  const metrics: TextAreaMetrics = {
    left: rect.left,
    top: rect.top - textarea.scrollTop,
    width: rect.width,
    paddingLeft: Number.parseFloat(style.paddingLeft) || 0,
    paddingTop: Number.parseFloat(style.paddingTop) || 0,
    lineHeight,
    charWidth: fontSize * 0.52,
  }
  const offset = textOffsetAtPoint(textarea.value, point, metrics)
  const [start, end] = selectWord ? wordRangeAt(textarea.value, offset) : [offset, offset]
  textarea.focus()
  textarea.setSelectionRange(start, end)
}

export function PrecisionCursor({
  enabled,
  sensitivity,
  workspaceRef,
  onClose,
}: PrecisionCursorProps) {
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const startRef = useRef<Point | null>(null)
  const lastRef = useRef<Point | null>(null)
  const startTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (bounds) setCursor({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
  }, [enabled, workspaceRef])

  if (!enabled) return null

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = { x: event.clientX, y: event.clientY }
    startRef.current = point
    lastRef.current = point
    startTimeRef.current = performance.now()
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const last = lastRef.current
    const bounds = workspaceRef.current?.getBoundingClientRect()
    if (!last || !bounds) return
    const next = { x: event.clientX, y: event.clientY }
    setCursor((current) =>
      moveCursor(current, { x: next.x - last.x, y: next.y - last.y }, bounds, sensitivity),
    )
    lastRef.current = next
  }

  const activateTarget = (selectWord: boolean) => {
    const target = document.elementFromPoint(cursor.x, cursor.y) as HTMLElement | null
    const control = target?.closest<HTMLElement>(
      'button, [role="button"], a, input, textarea, select',
    )
    if (control instanceof HTMLTextAreaElement) {
      placeTextareaSelection(control, cursor, selectWord)
      return
    }
    if (control instanceof HTMLInputElement) {
      control.focus()
      control.setSelectionRange?.(control.value.length, control.value.length)
      return
    }
    control?.click()
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    const shortTap = start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 9
    if (shortTap) activateTarget(performance.now() - startTimeRef.current > 420)
    startRef.current = null
    lastRef.current = null
  }

  return (
    <>
      <div
        className="precision-cursor"
        style={{ left: cursor.x, top: cursor.y }}
        aria-hidden="true"
      >
        <span />
      </div>
      <section className="trackpad" aria-label="Precision cursor trackpad">
        <div className="trackpad-heading">
          <div>
            <strong>Precision cursor</strong>
            <span>Drag to move · tap for caret · hold to select a word</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close precision cursor"
          >
            ×
          </button>
        </div>
        <div
          className="trackpad-pad"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </section>
    </>
  )
}
