import { moveCursor, textOffsetAtPoint, wordRangeAt } from '../src/components/PrecisionCursor'
describe('precision cursor movement', () => {
  const bounds = { left: 20, top: 10, right: 220, bottom: 310 } as DOMRect
  it('moves by the configured sensitivity within the workspace bounds', () => {
    expect(moveCursor({ x: 100, y: 100 }, { x: 10, y: -5 }, bounds, 1.2)).toEqual({ x: 112, y: 94 })
  })
  it('never moves beyond the workspace boundary', () => {
    expect(moveCursor({ x: 218, y: 308 }, { x: 80, y: 80 }, bounds, 1)).toEqual({ x: 212, y: 302 })
  })
  it('places a caret on the intended line and column', () => {
    expect(
      textOffsetAtPoint(
        'hello\nworld',
        { x: 24, y: 45 },
        {
          left: 0,
          top: 0,
          width: 300,
          paddingLeft: 0,
          paddingTop: 0,
          lineHeight: 20,
          charWidth: 8,
        },
      ),
    ).toBe(9)
  })
  it('selects a complete word for a long press', () => {
    expect(wordRangeAt('edit this draft', 6)).toEqual([5, 9])
  })
})
