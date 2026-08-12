import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// WCAG contrast, computed from the design tokens themselves.
//
// Contrast is a property of a colour pair, not of a rendered page, so it can be
// checked here without a browser. This is the one accessibility criterion the
// static tests can genuinely settle, and it is worth pinning: the failures found
// by measuring the live site were all narrow (the docs nav links sat at 4.47:1
// against a 4.5 requirement), which is exactly the kind of thing that drifts
// back the next time someone nudges a colour by eye.

const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8')

const block = (re, label) => {
  const m = css.match(re)
  if (!m) throw new Error(`Could not find the ${label} token block in tokens.css`)
  return Object.fromEntries(
    [...m[1].matchAll(/(--truss-[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]),
  )
}

// The palette is written out four times: light twice (the :root default and the
// explicit data-theme override) and dark twice (the media query and its
// override). They have to agree, which is itself asserted below.
const lightDefault = block(/:root\s*\{([^}]*)\}/, 'light default')
const lightExplicit = block(/:root\[data-theme='light'\]\s*\{([^}]*)\}/, 'explicit light')
const darkMedia = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/, 'dark media')
const darkExplicit = block(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/, 'explicit dark')

const rgb = (hex) => {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const THEMES = [
  ['light', lightDefault],
  ['dark', darkMedia],
]

// Every surface body text can land on. The page background is the harshest of
// the three for dark text, and it is the one the nav sits on.
const SURFACES = ['--truss-bg', '--truss-panel', '--truss-field']

describe.each(THEMES)('%s palette', (_theme, t) => {
  it.each(SURFACES)('reads muted text on %s at 4.5:1 or better', (surface) => {
    // 1.4.3 Contrast (Minimum), AA, normal-size text. --truss-muted carries the
    // lede, the nav links, the colophon and the sidebar group labels.
    expect(contrast(t['--truss-muted'], t[surface])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SURFACES)('reads body text on %s at 4.5:1 or better', (surface) => {
    expect(contrast(t['--truss-fg'], t[surface])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(SURFACES)('draws interactive borders on %s at 3:1 or better', (surface) => {
    // 1.4.11 Non-text Contrast, AA. The visual boundary of a control has to be
    // discernible: the search field, the hero's ghost buttons and the install
    // box are outlined and nothing else marks them. --truss-line stays as it is
    // for decorative hairlines (table rules, aside frames), which the criterion
    // does not reach.
    expect(contrast(t['--truss-line-strong'], t[surface])).toBeGreaterThanOrEqual(3)
  })

  it('shows a focus ring against the page at 3:1 or better', () => {
    // 2.4.11 / 1.4.11: the ring is the only indicator, so it has to be visible.
    expect(contrast(t['--truss-cyan'], t['--truss-bg'])).toBeGreaterThanOrEqual(3)
  })
})

describe('the palette is written out consistently', () => {
  // Four copies of the same values is a standing footgun: changing one and
  // missing another gives a theme that is correct until the user touches the
  // toggle, which is the hardest kind of bug to notice.
  // Compared key by key rather than as whole objects: the :root default also
  // carries the type and frame primitives (fonts, radius, gutter), which are
  // theme-independent and deliberately absent from the override blocks.
  const sameValues = (a, b) =>
    Object.fromEntries(Object.keys(b).map((k) => [k, [a[k], b[k]]]))

  it('states the same light values in both light blocks', () => {
    for (const [key, [fromDefault, fromOverride]] of Object.entries(
      sameValues(lightDefault, lightExplicit),
    )) {
      expect(fromDefault, key).toBe(fromOverride)
    }
  })

  it('states the same dark values in both dark blocks', () => {
    for (const [key, [fromMedia, fromOverride]] of Object.entries(
      sameValues(darkMedia, darkExplicit),
    )) {
      expect(fromMedia, key).toBe(fromOverride)
    }
  })
})
