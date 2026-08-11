import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Both the theme builder and the demo palette picker re-implement
// ThemeStylesheet::colorDeclarations() in the browser, because neither has PHP
// available. They are copies, so they drift silently: a token mapping or a
// derived value can change in the package and the preview keeps showing the old
// result, which is worse than no preview because people trust what they see.
//
// These assertions pin the derived values that are easiest to miss, since they
// are emitted outside the knob loop rather than driven by the KNOBS table.

const read = (p) => readFileSync(fileURLToPath(new URL(`../public/${p}`, import.meta.url)), 'utf8')

const SURFACES = [
  ['theme builder', 'theme-builder/index.html'],
  ['demo palette picker', 'demo/index.html'],
]

describe.each(SURFACES)('%s mirrors the package theme derivations', (_name, file) => {
  const source = read(file)

  it('derives the row hairline as a translucent tint of the border', () => {
    // Package: --bp-hair: rgba(r, g, b, 0.35) when `border` is a hex value.
    // Without this the preview shows the outline and the row separators at the
    // same weight, which is exactly what the package stopped doing.
    expect(source).toMatch(/--bp-hair\s*:\s*rgba\(/)
    expect(source).toMatch(/0\.35/)
  })

  it('derives the background grid from the accent', () => {
    expect(source).toMatch(/--bp-grid\s*:\s*rgba\(/)
    expect(source).toMatch(/--bp-grid-strong\s*:\s*rgba\(/)
  })

  it('maps the border knob onto all four line tokens', () => {
    expect(source).toMatch(/'border'\s*:\s*\[\s*'entity-border'\s*,\s*'hair'\s*,\s*'panel-line'\s*,\s*'field-line'\s*\]/)
  })
})
